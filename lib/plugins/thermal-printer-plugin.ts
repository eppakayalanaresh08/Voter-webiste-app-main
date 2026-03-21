import { registerPlugin } from '@capacitor/core';

export type NativePrintVoterPayload = {
  voterName?: string | null;
  voterNameTamil?: string | null;
  boothNo?: string | null;
  epicId?: string | null;
  houseNo?: string | null;
  serialNo?: string | null;
  boothName?: string | null;
  mobileNo?: string | null;
};

export type NativeConnectOptions = {
  macAddress?: string;
};

export type NativeConnectionState = {
  connected: boolean;
  detail?: string;
  address?: string;
};

export type NativePrintResult = {
  success: boolean;
};

export type NativePrinterDevice = {
  name?: string;
  address: string;
  type: 'classic' | 'ble' | 'dual' | 'unknown';
  looksLikePrinter?: boolean;
  connected?: boolean;
};

export type NativeBondedDevicesResult = {
  devices: NativePrinterDevice[];
};

export interface ThermalPrinterPlugin {
  getBondedDevices(): Promise<NativeBondedDevicesResult>;
  connect(options?: NativeConnectOptions): Promise<NativeConnectionState>;
  disconnect(): Promise<NativeConnectionState>;
  isConnected(): Promise<NativeConnectionState>;
  printText(options: { text: string }): Promise<NativePrintResult>;
  printVoter(options: NativePrintVoterPayload): Promise<NativePrintResult>;
}

export const NativeThermalPrinter = registerPlugin<ThermalPrinterPlugin>('ThermalPrinter');
