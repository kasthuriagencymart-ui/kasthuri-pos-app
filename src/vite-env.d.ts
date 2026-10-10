/// <reference types="vite/client" />

// WebUSB type declarations
interface USBEndpoint {
  endpointNumber: number;
  direction: 'in' | 'out';
  type: 'control' | 'interrupt' | 'bulk' | 'isochronous';
  packetSize: number;
}

interface USBInterface {
  interfaceNumber: number;
  alternates: { endpoints: USBEndpoint[] }[];
}

interface USBConfiguration {
  configurationValue: number;
  interfaces: USBInterface[];
}

interface USBDevice {
  vendorId: number;
  productId: number;
  productName?: string;
  manufacturerName?: string;
  serialNumber?: string;
  configuration: USBConfiguration | null;
  configurations: USBConfiguration[];
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(value: number): Promise<void>;
  claimInterface(number: number): Promise<void>;
  releaseInterface(number: number): Promise<void>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<{ bytesWritten: number; status: string }>;
  transferIn(endpointNumber: number, length: number): Promise<{ data: DataView; status: string }>;
}

interface USB {
  getDevices(): Promise<USBDevice[]>;
  requestDevice(options: { filters: { classCode?: number; vendorId?: number; productId?: number }[] }): Promise<USBDevice>;
}

interface Navigator {
  usb?: USB;
}

// Web Bluetooth type declarations
interface BluetoothRemoteGATTCharacteristic {
  properties: {
    broadcast: boolean;
    read: boolean;
    writeWithoutResponse: boolean;
    write: boolean;
    notify: boolean;
    indicate: boolean;
  };
  writeValueWithResponse(data: BufferSource): Promise<void>;
  writeValueWithoutResponse(data: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTService {
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
  getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTServer {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTService>;
  getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothDevice {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

interface Bluetooth {
  requestDevice(options: {
    filters: { services: string[] }[];
    optionalServices?: string[];
  }): Promise<BluetoothDevice>;
  getAvailability(): Promise<boolean>;
}

interface Navigator {
  bluetooth?: Bluetooth;
}
