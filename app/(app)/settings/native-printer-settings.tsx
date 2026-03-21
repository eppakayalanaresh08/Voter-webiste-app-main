'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { isNativeApp } from '@/lib/native-bridge';
import {
  connectNativePrinter,
  disconnectNativePrinter,
  getNativePrinterConnectionState,
  getPreferredNativePrinterMac,
  listNativeBondedPrinters,
  printNativeTestText,
  setPreferredNativePrinterMac
} from '@/lib/native-printer';
import type { NativeConnectionState, NativePrinterDevice } from '@/lib/plugins/thermal-printer-plugin';

function byPrinterPriority(a: NativePrinterDevice, b: NativePrinterDevice) {
  const aPriority = a.looksLikePrinter ? 0 : 1;
  const bPriority = b.looksLikePrinter ? 0 : 1;
  if (aPriority !== bPriority) return aPriority - bPriority;
  return (a.name ?? a.address).localeCompare(b.name ?? b.address);
}

export default function NativePrinterSettings() {
  const nativeApp = isNativeApp();
  const [devices, setDevices] = useState<NativePrinterDevice[]>([]);
  const [connection, setConnection] = useState<NativeConnectionState>({ connected: false });
  const [preferredMac, setPreferredMac] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyMac, setBusyMac] = useState('');
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);

  const orderedDevices = useMemo(() => [...devices].sort(byPrinterPriority), [devices]);

  const refreshState = useCallback(async () => {
    if (!nativeApp) return;
    setIsRefreshing(true);
    try {
      const [printerDevices, printerConnection] = await Promise.all([
        listNativeBondedPrinters(),
        getNativePrinterConnectionState()
      ]);
      setDevices(printerDevices);
      setConnection(printerConnection);
      setPreferredMac(getPreferredNativePrinterMac());
      setIsError(false);
      setStatus('');
    } catch (error) {
      setIsError(true);
      setStatus(error instanceof Error ? error.message : 'Unable to fetch Bluetooth devices.');
    } finally {
      setIsRefreshing(false);
    }
  }, [nativeApp]);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  // if (!nativeApp) return null;

  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Thermal Printer
            </Typography>
            <Button variant="outlined" size="small" onClick={() => void refreshState()} disabled={isRefreshing}>
              {isRefreshing ? 'Refreshing...' : 'Refresh Devices'}
            </Button>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            Pair printer in Android Bluetooth settings first, then connect here.
          </Typography>

          {preferredMac ? (
            <Alert severity="info">Preferred printer: {preferredMac}</Alert>
          ) : (
            <Alert severity="warning">No preferred printer selected yet.</Alert>
          )}

          {orderedDevices.length === 0 ? (
            <Alert severity="warning">No bonded Bluetooth devices found.</Alert>
          ) : (
            <Stack spacing={1}>
              {orderedDevices.map((device) => {
                const isConnected =
                  connection.connected &&
                  Boolean(connection.address) &&
                  connection.address?.toUpperCase() === device.address.toUpperCase();
                const isPreferred = preferredMac.toUpperCase() === device.address.toUpperCase();
                const isBusy = busyMac === device.address;

                return (
                  <Stack
                    key={device.address}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    justifyContent="space-between"
                    sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
                  >
                    <Stack spacing={0.3}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {device.name || 'Unnamed Bluetooth Device'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {device.address}
                      </Typography>
                      <Stack direction="row" spacing={0.8}>
                        <Chip size="small" label={device.type.toUpperCase()} />
                        {device.looksLikePrinter ? <Chip size="small" color="success" label="Printer" /> : null}
                        {isPreferred ? <Chip size="small" color="primary" label="Preferred" /> : null}
                        {isConnected ? <Chip size="small" color="success" label="Connected" /> : null}
                      </Stack>
                    </Stack>

                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={isBusy || isConnected}
                        onClick={async () => {
                          setBusyMac(device.address);
                          try {
                            const next = await connectNativePrinter(device.address);
                            setConnection(next);
                            setPreferredMac(getPreferredNativePrinterMac());
                            setStatus(next.detail ?? 'Printer connected.');
                            setIsError(false);
                          } catch (error) {
                            setIsError(true);
                            setStatus(error instanceof Error ? error.message : 'Printer connect failed.');
                          } finally {
                            setBusyMac('');
                          }
                        }}
                      >
                        {isBusy ? 'Connecting...' : isConnected ? 'Connected' : 'Connect'}
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => {
                          setPreferredNativePrinterMac(device.address);
                          setPreferredMac(getPreferredNativePrinterMac());
                          setIsError(false);
                          setStatus('Preferred printer saved.');
                        }}
                      >
                        Save
                      </Button>
                    </Stack>
                  </Stack>
                );
              })}
            </Stack>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="outlined"
              color="inherit"
              disabled={!connection.connected}
              onClick={async () => {
                try {
                  const next = await disconnectNativePrinter();
                  setConnection(next);
                  setStatus('Printer disconnected.');
                  setIsError(false);
                } catch (error) {
                  setIsError(true);
                  setStatus(error instanceof Error ? error.message : 'Unable to disconnect printer.');
                }
              }}
            >
              Disconnect
            </Button>
            <Button
              variant="outlined"
              disabled={!connection.connected}
              onClick={async () => {
                try {
                  await printNativeTestText('ClickVote printer test\n\n');
                  setStatus('Test print sent.');
                  setIsError(false);
                } catch (error) {
                  setIsError(true);
                  setStatus(error instanceof Error ? error.message : 'Test print failed.');
                }
              }}
            >
              Test Print
            </Button>
          </Stack>

          {status ? <Alert severity={isError ? 'error' : 'success'}>{status}</Alert> : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
