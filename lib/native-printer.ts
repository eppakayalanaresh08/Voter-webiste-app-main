import { Capacitor } from '@capacitor/core';
import { thermalPrinter, type ThermalPrinter } from '@/lib/thermal-printer';
import {
  NativeThermalPrinter,
  type NativeConnectionState,
  type NativePrinterDevice
} from '@/lib/plugins/thermal-printer-plugin';

export type PrinterVoterPayload = Parameters<ThermalPrinter['printVoter']>[0];
export type NativePrinterOptions = {
  macAddress?: string;
};

const PREFERRED_PRINTER_MAC_KEY = 'clickvote.nativePrinter.mac';

interface PrinterBridge {
  printVoter(voter: PrinterVoterPayload, options?: NativePrinterOptions): Promise<void>;
  printImage(dataUrl: string, options?: NativePrinterOptions): Promise<void>;
}

class WebBluetoothPrinterBridge implements PrinterBridge {
  async printVoter(voter: PrinterVoterPayload) {
    await thermalPrinter.printVoter(voter);
  }

  async printImage(dataUrl: string) {
    await thermalPrinter.printImageDataUrl(dataUrl);
  }
}

class NativeCapacitorPrinterBridge implements PrinterBridge {
  async printVoter(voter: PrinterVoterPayload, options?: NativePrinterOptions) {
    const preferredMac = normalizeMacAddress(options?.macAddress ?? getPreferredNativePrinterMac());
    const connection: NativeConnectionState = await NativeThermalPrinter.isConnected().catch(() => ({
      connected: false
    }));

    const shouldReconnect =
      !connection.connected ||
      (preferredMac &&
        connection.address &&
        connection.address.toUpperCase() !== preferredMac.toUpperCase());

    if (shouldReconnect) {
      if (connection.connected) {
        await NativeThermalPrinter.disconnect().catch(() => undefined);
      }
      await NativeThermalPrinter.connect(preferredMac ? { macAddress: preferredMac } : undefined);
    }

    await NativeThermalPrinter.printVoter({
      voterName: voter.voter_name,
      voterNameTamil: voter.voter_name_tamil,
      boothNo: voter.booth_no,
      epicId: voter.epic_id,
      houseNo: voter.house_no,
      serialNo: voter.serial_no,
      boothName: voter.booth_name,
      mobileNo: voter.mobile_no
    });
  }

  async printImage(dataUrl: string, options?: NativePrinterOptions) {
    const preferredMac = normalizeMacAddress(options?.macAddress ?? getPreferredNativePrinterMac());
    const connection: NativeConnectionState = await NativeThermalPrinter.isConnected().catch(() => ({
      connected: false
    }));

    const shouldReconnect =
      !connection.connected ||
      (preferredMac &&
        connection.address &&
        connection.address.toUpperCase() !== preferredMac.toUpperCase());

    if (shouldReconnect) {
      if (connection.connected) {
        await NativeThermalPrinter.disconnect().catch(() => undefined);
      }
      await NativeThermalPrinter.connect(preferredMac ? { macAddress: preferredMac } : undefined);
    }

    await NativeThermalPrinter.printImage({ dataUrl });
  }
}

const webBridge = new WebBluetoothPrinterBridge();
const nativeBridge = new NativeCapacitorPrinterBridge();

function getPrinterBridge(): PrinterBridge {
  return Capacitor.isNativePlatform() ? nativeBridge : webBridge;
}

function normalizeMacAddress(value: string | null | undefined) {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  return raw.replace(/-/g, ':').toUpperCase();
}

export function getPreferredNativePrinterMac() {
  if (typeof window === 'undefined') return '';
  return normalizeMacAddress(window.localStorage.getItem(PREFERRED_PRINTER_MAC_KEY));
}

export function setPreferredNativePrinterMac(value: string) {
  if (typeof window === 'undefined') return;
  const normalized = normalizeMacAddress(value);
  if (!normalized) {
    window.localStorage.removeItem(PREFERRED_PRINTER_MAC_KEY);
    return;
  }
  window.localStorage.setItem(PREFERRED_PRINTER_MAC_KEY, normalized);
}

export function isNativePrinterPending() {
  return Capacitor.isNativePlatform();
}

export async function getNativePrinterConnectionState(): Promise<NativeConnectionState> {
  if (!Capacitor.isNativePlatform()) {
    return { connected: false, detail: 'Native printer bridge unavailable on web.' };
  }
  return NativeThermalPrinter.isConnected();
}

export async function listNativeBondedPrinters(): Promise<NativePrinterDevice[]> {
  if (!Capacitor.isNativePlatform()) return [];
  const response = await NativeThermalPrinter.getBondedDevices();
  return response.devices ?? [];
}

export async function connectNativePrinter(macAddress?: string) {
  if (!Capacitor.isNativePlatform()) {
    return { connected: false, detail: 'Native printer bridge unavailable on web.' } as NativeConnectionState;
  }
  const normalized = normalizeMacAddress(macAddress);
  const state = await NativeThermalPrinter.connect(normalized ? { macAddress: normalized } : undefined);
  if (state.connected && state.address) {
    setPreferredNativePrinterMac(state.address);
  } else if (state.connected && normalized) {
    setPreferredNativePrinterMac(normalized);
  }
  return state;
}

export async function disconnectNativePrinter() {
  if (!Capacitor.isNativePlatform()) {
    return { connected: false, detail: 'Native printer bridge unavailable on web.' } as NativeConnectionState;
  }
  return NativeThermalPrinter.disconnect();
}

export async function printNativeTestText(text = 'ClickVote printer test\n\n') {
  if (!Capacitor.isNativePlatform()) return;
  await NativeThermalPrinter.printText({ text });
}

export async function printVoterSlip(voter: PrinterVoterPayload, options?: NativePrinterOptions) {
  await getPrinterBridge().printVoter(voter, options);
}

export async function printVoterSlipImage(dataUrl: string, options?: NativePrinterOptions) {
  await getPrinterBridge().printImage(dataUrl, options);
}
