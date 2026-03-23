package com.clickvote.plugins;

import android.annotation.SuppressLint;
import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.os.Build;
import android.util.Base64;
import android.os.ParcelUuid;
import android.text.TextUtils;

import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(
    name = "ThermalPrinter",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.ACCESS_FINE_LOCATION
            }
        )
    }
)
public class ThermalPrinterPlugin extends Plugin {
  private static final String BLUETOOTH_ALIAS = "bluetooth";
  private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805f9b34fb");

  private enum ConnectionType {
    NONE, CLASSIC, BLE
  }

  private final Object connectionLock = new Object();
  private final Object bleWriteLock = new Object();

  private BluetoothAdapter bluetoothAdapter;
  private BluetoothSocket classicSocket;
  private OutputStream classicOutputStream;
  private BluetoothGatt bleGatt;
  private BluetoothGattCharacteristic bleWriteCharacteristic;
  private ConnectionType connectionType = ConnectionType.NONE;
  private String connectedAddress;
  private boolean bleWriteAck;
  private boolean bleWriteSuccess;

  @Override
  public void load() {
    BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
    bluetoothAdapter = manager != null ? manager.getAdapter() : BluetoothAdapter.getDefaultAdapter();
  }

  @PluginMethod
  public void isConnected(PluginCall call) {
    call.resolve(buildConnectionState(currentlyConnected(), currentlyConnected() ? "Connected" : "Not connected"));
  }

  @PluginMethod
  public void getBondedDevices(PluginCall call) {
    if (getPermissionState(BLUETOOTH_ALIAS) != PermissionState.GRANTED) {
      requestPermissionForAlias(BLUETOOTH_ALIAS, call, "bluetoothListPermsCallback");
      return;
    }

    bridge.execute(() -> {
      try {
        call.resolve(buildBondedDevicesResponse());
      } catch (Exception e) {
        call.reject(e.getMessage(), e);
      }
    });
  }

  @PluginMethod
  public void connect(PluginCall call) {
    if (getPermissionState(BLUETOOTH_ALIAS) != PermissionState.GRANTED) {
      requestPermissionForAlias(BLUETOOTH_ALIAS, call, "bluetoothPermsCallback");
      return;
    }

    final String macAddress = call.getString("macAddress");

    bridge.execute(() -> {
      try {
        ensureBluetoothReady();

        if (currentlyConnected()) {
          call.resolve(buildConnectionState(true, "Already connected"));
          return;
        }

        disconnectInternal();

        Exception classicError = null;
        try {
          connectClassic(macAddress);
          call.resolve(buildConnectionState(true, "Connected via Bluetooth Classic"));
          return;
        } catch (Exception ex) {
          classicError = ex;
          disconnectInternal();
        }

        try {
          connectBle(macAddress);
          call.resolve(buildConnectionState(true, "Connected via BLE"));
        } catch (Exception bleError) {
          disconnectInternal();
          String detail = "Unable to connect printer.";
          if (classicError != null) {
            detail += " Classic: " + classicError.getMessage() + ".";
          }
          detail += " BLE: " + bleError.getMessage();
          call.reject(detail, bleError);
        }
      } catch (Exception e) {
        call.reject(e.getMessage(), e);
      }
    });
  }

  @PermissionCallback
  private void bluetoothPermsCallback(PluginCall call) {
    if (getPermissionState(BLUETOOTH_ALIAS) == PermissionState.GRANTED) {
      connect(call);
      return;
    }
    call.reject("Bluetooth permission denied");
  }

  @PermissionCallback
  private void bluetoothListPermsCallback(PluginCall call) {
    if (getPermissionState(BLUETOOTH_ALIAS) == PermissionState.GRANTED) {
      getBondedDevices(call);
      return;
    }
    call.reject("Bluetooth permission denied");
  }

  @PluginMethod
  public void disconnect(PluginCall call) {
    bridge.execute(() -> {
      disconnectInternal();
      call.resolve(buildConnectionState(false, "Disconnected"));
    });
  }

  @PluginMethod
  public void printText(PluginCall call) {
    String text = call.getString("text");
    if (text == null || text.trim().isEmpty()) {
      call.reject("text is required");
      return;
    }

    bridge.execute(() -> {
      try {
        ensureConnected();
        writeBytes(new byte[]{0x1B, 0x40}); // Initialize
        writeBytes(new byte[]{0x1B, 0x61, 0x00}); // Left align
        writeBytes(text.getBytes(StandardCharsets.UTF_8));
        writeBytes(new byte[]{0x0A, 0x0A}); // Feed lines
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
      } catch (Exception e) {
        call.reject("printText failed: " + e.getMessage(), e);
      }
    });
  }

  @PluginMethod
  public void printVoter(PluginCall call) {
    final String serialNo = safe(call.getString("serialNo"));
    final String voterName = safe(call.getString("voterName"));
    final String voterNameTamil = safeNullable(call.getString("voterNameTamil"));
    final String epicId = safe(call.getString("epicId"));
    final String boothNo = safe(call.getString("boothNo"));
    final String boothName = safeNullable(call.getString("boothName"));
    final String houseNo = safe(call.getString("houseNo"));
    final String mobileNo = safe(call.getString("mobileNo"));

    bridge.execute(() -> {
      try {
        ensureConnected();

        StringBuilder body = new StringBuilder();
        body.append("--------------------------------\n");
        appendLine(body, "Serial No", serialNo);
        appendLine(body, "Name", voterName);
        if (!TextUtils.isEmpty(voterNameTamil)) {
          appendLine(body, "Name (TA)", voterNameTamil);
        }
        appendLine(body, "Voter ID", epicId);
        appendLine(body, "Booth No", boothNo);
        if (!TextUtils.isEmpty(boothName)) {
          appendLine(body, "Booth", boothName);
        }
        appendLine(body, "House No", houseNo);
        appendLine(body, "Mobile", mobileNo);
        body.append("--------------------------------\n");

        writeBytes(new byte[]{0x1B, 0x40}); // Init
        writeBytes(new byte[]{0x1B, 0x61, 0x01}); // Center
        writeBytes(new byte[]{0x1B, 0x45, 0x01}); // Bold on
        writeBytes(new byte[]{0x1D, 0x21, 0x11}); // Double size
        writeBytes("VOTER SLIP\n".getBytes(StandardCharsets.UTF_8));
        writeBytes(new byte[]{0x1D, 0x21, 0x00}); // Normal size
        writeBytes(new byte[]{0x1B, 0x45, 0x00}); // Bold off

        writeBytes(new byte[]{0x1B, 0x61, 0x00}); // Left
        writeBytes(body.toString().getBytes(StandardCharsets.UTF_8));

        writeBytes(new byte[]{0x1B, 0x61, 0x01}); // Center
        writeBytes("\n*** VOTE FOR BETTER FUTURE ***\n\n".getBytes(StandardCharsets.UTF_8));
        writeBytes(new byte[]{0x1D, 0x56, 0x41, 0x00}); // Partial cut

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
      } catch (Exception e) {
        call.reject("printVoter failed: " + e.getMessage(), e);
      }
    });
  }

  @PluginMethod
  public void printImage(PluginCall call) {
    final String dataUrl = call.getString("dataUrl");
    if (TextUtils.isEmpty(dataUrl)) {
      call.reject("dataUrl is required");
      return;
    }

    bridge.execute(() -> {
      try {
        ensureConnected();
        Bitmap bitmap = decodeBitmapFromDataUrl(dataUrl);
        if (bitmap == null) {
          throw new IOException("Unable to decode print image");
        }

        writeBytes(new byte[]{0x1B, 0x40});
        Thread.sleep(40);
        writeBytes(new byte[]{0x1B, 0x61, 0x01});
        writeBitmap(bitmap);
        writeBytes(new byte[]{0x0A, 0x0A, 0x0A});
        writeBytes(new byte[]{0x1D, 0x56, 0x41, 0x00});

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
      } catch (Exception e) {
        call.reject("printImage failed: " + e.getMessage(), e);
      }
    });
  }

  private void appendLine(StringBuilder sb, String label, String value) {
    sb.append(String.format(Locale.US, "%-10s: %s\n", label, value));
  }

  private Bitmap decodeBitmapFromDataUrl(String dataUrl) {
    String raw = dataUrl.trim();
    int commaIndex = raw.indexOf(',');
    String base64 = commaIndex >= 0 ? raw.substring(commaIndex + 1) : raw;
    byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
    Bitmap source = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
    if (source == null) return null;
    return scaleBitmapToPrinterWidth(source, 384);
  }

  private Bitmap scaleBitmapToPrinterWidth(Bitmap source, int maxWidth) {
    if (source.getWidth() <= maxWidth) {
      return source.copy(Bitmap.Config.ARGB_8888, false);
    }

    float ratio = (float) maxWidth / (float) source.getWidth();
    int targetHeight = Math.max(1, Math.round(source.getHeight() * ratio));
    Bitmap scaled = Bitmap.createBitmap(maxWidth, targetHeight, Bitmap.Config.ARGB_8888);
    Canvas canvas = new Canvas(scaled);
    canvas.drawColor(Color.WHITE);
    Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
    canvas.drawBitmap(source, null, new android.graphics.Rect(0, 0, maxWidth, targetHeight), paint);
    return scaled;
  }

  private void writeBitmap(Bitmap bitmap) throws IOException, InterruptedException {
    int width = bitmap.getWidth();
    int height = bitmap.getHeight();
    int widthBytes = (width + 7) / 8;
    byte[] imageBytes = new byte[widthBytes * height];

    for (int y = 0; y < height; y++) {
      for (int x = 0; x < width; x++) {
        int color = bitmap.getPixel(x, y);
        int gray = (int) (0.299 * Color.red(color) + 0.587 * Color.green(color) + 0.114 * Color.blue(color));
        boolean isBlack = gray < 180;
        if (isBlack) {
          int index = y * widthBytes + (x / 8);
          imageBytes[index] |= (byte) (0x80 >> (x % 8));
        }
      }
    }

    byte xL = (byte) (widthBytes & 0xFF);
    byte xH = (byte) ((widthBytes >> 8) & 0xFF);
    byte yL = (byte) (height & 0xFF);
    byte yH = (byte) ((height >> 8) & 0xFF);

    writeBytes(new byte[]{0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH});

    final int chunkSize = 512;
    for (int i = 0; i < imageBytes.length; i += chunkSize) {
      int end = Math.min(i + chunkSize, imageBytes.length);
      writeBytes(Arrays.copyOfRange(imageBytes, i, end));
      Thread.sleep(20);
    }
  }

  private String safe(String value) {
    if (value == null) return "-";
    String trimmed = value.trim();
    return trimmed.isEmpty() ? "-" : trimmed;
  }

  private String safeNullable(String value) {
    if (value == null) return null;
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private JSObject buildConnectionState(boolean connected, String detail) {
    JSObject ret = new JSObject();
    ret.put("connected", connected);
    ret.put("detail", detail);
    if (!TextUtils.isEmpty(connectedAddress)) {
      ret.put("address", connectedAddress);
    }
    return ret;
  }

  @SuppressLint("MissingPermission")
  private JSObject buildBondedDevicesResponse() throws IOException {
    ensureBluetoothReady();

    Set<BluetoothDevice> bondedDevices = bluetoothAdapter.getBondedDevices();
    List<BluetoothDevice> devices = new ArrayList<>();
    if (bondedDevices != null) {
      devices.addAll(bondedDevices);
    }

    Collections.sort(
      devices,
      Comparator
        .comparing((BluetoothDevice d) -> !looksLikePrinter(d))
        .thenComparing(d -> {
          String name = d.getName();
          return name == null ? "" : name.toLowerCase(Locale.US);
        })
        .thenComparing(BluetoothDevice::getAddress)
    );

    JSArray jsDevices = new JSArray();
    boolean connected;
    String activeAddress;
    synchronized (connectionLock) {
      connected = currentlyConnected();
      activeAddress = connectedAddress;
    }

    for (BluetoothDevice device : devices) {
      JSObject item = new JSObject();
      item.put("name", device.getName());
      item.put("address", device.getAddress());
      item.put("type", mapDeviceType(device.getType()));
      item.put("looksLikePrinter", looksLikePrinter(device));
      item.put(
        "connected",
        connected
          && activeAddress != null
          && activeAddress.equalsIgnoreCase(device.getAddress())
      );
      jsDevices.put(item);
    }

    JSObject ret = new JSObject();
    ret.put("devices", jsDevices);
    return ret;
  }

  private boolean currentlyConnected() {
    synchronized (connectionLock) {
      if (connectionType == ConnectionType.CLASSIC) {
        return classicSocket != null && classicSocket.isConnected();
      }
      if (connectionType == ConnectionType.BLE) {
        return bleGatt != null && bleWriteCharacteristic != null;
      }
      return false;
    }
  }

  private String mapDeviceType(int type) {
    if (type == BluetoothDevice.DEVICE_TYPE_CLASSIC) return "classic";
    if (type == BluetoothDevice.DEVICE_TYPE_LE) return "ble";
    if (type == BluetoothDevice.DEVICE_TYPE_DUAL) return "dual";
    return "unknown";
  }

  private void ensureConnected() throws IOException {
    if (!currentlyConnected()) {
      throw new IOException("Printer is not connected");
    }
  }

  private void ensureBluetoothReady() throws IOException {
    if (bluetoothAdapter == null) {
      throw new IOException("Bluetooth adapter not available");
    }
    if (!bluetoothAdapter.isEnabled()) {
      throw new IOException("Bluetooth is disabled");
    }
  }

  @SuppressLint("MissingPermission")
  private void connectClassic(String macAddress) throws IOException {
    BluetoothDevice device = selectDevice(macAddress, false);
    if (device == null) {
      throw new IOException("No bonded printer found for classic connection");
    }

    bluetoothAdapter.cancelDiscovery();

    BluetoothSocket socket = null;
    IOException firstError = null;
    try {
      socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
      socket.connect();
    } catch (IOException e) {
      firstError = e;
      closeQuietly(socket);
      socket = null;
    }

    if (socket == null || !socket.isConnected()) {
      try {
        socket = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
        socket.connect();
      } catch (IOException secondError) {
        closeQuietly(socket);
        IOException err = new IOException("Classic connection failed: " + secondError.getMessage());
        if (firstError != null) {
          err.addSuppressed(firstError);
        }
        throw err;
      }
    }

    OutputStream out = socket.getOutputStream();
    synchronized (connectionLock) {
      classicSocket = socket;
      classicOutputStream = out;
      connectionType = ConnectionType.CLASSIC;
      connectedAddress = device.getAddress();
    }
  }

  @SuppressLint("MissingPermission")
  private void connectBle(String macAddress) throws Exception {
    BluetoothDevice device = selectDevice(macAddress, true);
    if (device == null) {
      throw new IOException("No bonded printer found for BLE connection");
    }

    final CountDownLatch connectedLatch = new CountDownLatch(1);
    final String[] errorHolder = new String[1];

    BluetoothGattCallback callback = new BluetoothGattCallback() {
      @Override
      public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
        if (newState == BluetoothProfile.STATE_CONNECTED) {
          if (!gatt.discoverServices()) {
            errorHolder[0] = "BLE service discovery could not start";
            connectedLatch.countDown();
          }
          return;
        }

        if (newState == BluetoothProfile.STATE_DISCONNECTED) {
          if (status != BluetoothGatt.GATT_SUCCESS) {
            errorHolder[0] = "BLE disconnected with status " + status;
          } else {
            errorHolder[0] = "BLE disconnected";
          }
          connectedLatch.countDown();
        }
      }

      @Override
      public void onServicesDiscovered(BluetoothGatt gatt, int status) {
        if (status != BluetoothGatt.GATT_SUCCESS) {
          errorHolder[0] = "BLE discoverServices failed with status " + status;
          connectedLatch.countDown();
          return;
        }

        BluetoothGattCharacteristic writable = findWritableCharacteristic(gatt);
        if (writable == null) {
          errorHolder[0] = "No writable BLE characteristic found";
          connectedLatch.countDown();
          return;
        }

        synchronized (connectionLock) {
          bleGatt = gatt;
          bleWriteCharacteristic = writable;
          connectionType = ConnectionType.BLE;
          connectedAddress = device.getAddress();
        }
        connectedLatch.countDown();
      }

      @Override
      public void onCharacteristicWrite(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, int status) {
        synchronized (bleWriteLock) {
          bleWriteSuccess = status == BluetoothGatt.GATT_SUCCESS;
          bleWriteAck = true;
          bleWriteLock.notifyAll();
        }
      }
    };

    BluetoothGatt gatt;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      gatt = device.connectGatt(getContext(), false, callback, BluetoothDevice.TRANSPORT_LE);
    } else {
      gatt = device.connectGatt(getContext(), false, callback);
    }

    if (gatt == null) {
      throw new IOException("BLE connectGatt returned null");
    }

    boolean done = connectedLatch.await(15, TimeUnit.SECONDS);
    if (!done || !currentlyConnected()) {
      gatt.disconnect();
      gatt.close();
      throw new IOException(errorHolder[0] != null ? errorHolder[0] : "BLE connection timed out");
    }
  }

  @SuppressLint("MissingPermission")
  private BluetoothDevice selectDevice(String macAddress, boolean preferBle) throws IOException {
    ensureBluetoothReady();

    if (!TextUtils.isEmpty(macAddress)) {
      try {
        return bluetoothAdapter.getRemoteDevice(macAddress);
      } catch (IllegalArgumentException ex) {
        throw new IOException("Invalid macAddress: " + macAddress);
      }
    }

    Set<BluetoothDevice> bondedDevices = bluetoothAdapter.getBondedDevices();
    if (bondedDevices == null || bondedDevices.isEmpty()) {
      throw new IOException("No bonded Bluetooth devices found");
    }

    BluetoothDevice fallbackPrinter = null;
    for (BluetoothDevice device : bondedDevices) {
      if (!looksLikePrinter(device)) continue;
      if (fallbackPrinter == null) fallbackPrinter = device;

      int type = device.getType();
      if (preferBle && (type == BluetoothDevice.DEVICE_TYPE_LE || type == BluetoothDevice.DEVICE_TYPE_DUAL)) {
        return device;
      }
      if (!preferBle && type != BluetoothDevice.DEVICE_TYPE_LE) {
        return device;
      }
    }

    if (fallbackPrinter != null) return fallbackPrinter;
    return bondedDevices.iterator().next();
  }

  @SuppressLint("MissingPermission")
  private boolean looksLikePrinter(BluetoothDevice device) {
    String name = device.getName();
    if (name != null) {
      String lower = name.toLowerCase(Locale.US);
      if (lower.startsWith("tp")
          || lower.startsWith("mtp")
          || lower.startsWith("innerprinter")
          || lower.contains("printer")) {
        return true;
      }
    }

    ParcelUuid[] uuids = device.getUuids();
    if (uuids != null) {
      for (ParcelUuid pu : uuids) {
        if (SPP_UUID.equals(pu.getUuid())) {
          return true;
        }
      }
    }
    return false;
  }

  private BluetoothGattCharacteristic findWritableCharacteristic(BluetoothGatt gatt) {
    for (BluetoothGattService service : gatt.getServices()) {
      for (BluetoothGattCharacteristic characteristic : service.getCharacteristics()) {
        int properties = characteristic.getProperties();
        boolean canWrite = (properties & BluetoothGattCharacteristic.PROPERTY_WRITE) != 0;
        boolean canWriteNoResp = (properties & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0;
        if (canWrite || canWriteNoResp) {
          return characteristic;
        }
      }
    }
    return null;
  }

  private void writeBytes(byte[] data) throws IOException, InterruptedException {
    ConnectionType mode;
    synchronized (connectionLock) {
      mode = connectionType;
    }

    if (mode == ConnectionType.CLASSIC) {
      writeClassic(data);
      return;
    }

    if (mode == ConnectionType.BLE) {
      writeBle(data);
      return;
    }

    throw new IOException("Printer connection is not active");
  }

  private void writeClassic(byte[] data) throws IOException, InterruptedException {
    OutputStream out;
    synchronized (connectionLock) {
      out = classicOutputStream;
    }
    if (out == null) {
      throw new IOException("Classic output stream unavailable");
    }

    final int chunkSize = 256;
    for (int i = 0; i < data.length; i += chunkSize) {
      int end = Math.min(i + chunkSize, data.length);
      out.write(data, i, end - i);
      out.flush();
      Thread.sleep(5);
    }
  }

  private void writeBle(byte[] data) throws IOException, InterruptedException {
    final int chunkSize = 20;
    for (int i = 0; i < data.length; i += chunkSize) {
      int end = Math.min(i + chunkSize, data.length);
      writeBleChunk(Arrays.copyOfRange(data, i, end));
      Thread.sleep(10);
    }
  }

  @SuppressLint("MissingPermission")
  private void writeBleChunk(byte[] chunk) throws IOException, InterruptedException {
    BluetoothGatt gatt;
    BluetoothGattCharacteristic characteristic;
    synchronized (connectionLock) {
      gatt = bleGatt;
      characteristic = bleWriteCharacteristic;
    }

    if (gatt == null || characteristic == null) {
      throw new IOException("BLE printer channel unavailable");
    }

    synchronized (bleWriteLock) {
      bleWriteAck = false;
      bleWriteSuccess = false;
    }

    boolean started;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      int result = gatt.writeCharacteristic(
          characteristic,
          chunk,
          BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
      );
      started = result == 0;
    } else {
      characteristic.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
      characteristic.setValue(chunk);
      started = gatt.writeCharacteristic(characteristic);
    }

    if (!started) {
      throw new IOException("BLE write failed to start");
    }

    long deadline = System.currentTimeMillis() + 2000;
    synchronized (bleWriteLock) {
      while (!bleWriteAck && System.currentTimeMillis() < deadline) {
        bleWriteLock.wait(120);
      }

      if (!bleWriteAck) {
        throw new IOException("BLE write timeout");
      }
      if (!bleWriteSuccess) {
        throw new IOException("BLE write failed");
      }
    }
  }

  @SuppressLint("MissingPermission")
  private void disconnectInternal() {
    synchronized (connectionLock) {
      if (classicOutputStream != null) {
        try {
          classicOutputStream.close();
        } catch (Exception ignored) {
        }
      }
      classicOutputStream = null;

      if (classicSocket != null) {
        closeQuietly(classicSocket);
      }
      classicSocket = null;

      if (bleGatt != null) {
        try {
          bleGatt.disconnect();
        } catch (Exception ignored) {
        }
        try {
          bleGatt.close();
        } catch (Exception ignored) {
        }
      }
      bleGatt = null;
      bleWriteCharacteristic = null;

      connectionType = ConnectionType.NONE;
      connectedAddress = null;
    }
  }

  private void closeQuietly(BluetoothSocket socket) {
    if (socket == null) return;
    try {
      socket.close();
    } catch (Exception ignored) {
    }
  }
}
