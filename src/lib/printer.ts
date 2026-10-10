import type { Sale, ShopSettings, SaleItem } from '@/types';

export type PrinterConnection = 'usb' | 'bluetooth' | 'browser' | 'none';
export type PrinterStatus = 'disconnected' | 'connected' | 'connecting' | 'error';

export interface PrinterState {
  connection: PrinterConnection;
  status: PrinterStatus;
  name: string;
  error: string;
}

type Listener = (state: PrinterState) => void;

class PrinterManager {
  private state: PrinterState = {
    connection: 'none',
    status: 'disconnected',
    name: '',
    error: '',
  };

  private listeners: Set<Listener> = new Set();
  private usbDevice: USBDevice | null = null;
  private usbOutEndpoint: USBEndpoint | null = null;
  private bluetoothCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private bluetoothDevice: BluetoothDevice | null = null;

  getState(): PrinterState {
    return { ...this.state };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private setState(partial: Partial<PrinterState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => l(this.getState()));
  }

  isWebUSBSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator;
  }

  isBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  // ─── ESC/POS command builders ───────────────────────────────

  private init(): number[] {
    return [0x1b, 0x40]; // ESC @
  }

  private setAlign(align: 'left' | 'center' | 'right'): number[] {
    const n = align === 'center' ? 1 : align === 'right' ? 2 : 0;
    return [0x1b, 0x61, n]; // ESC a n
  }

  private setBold(on: boolean): number[] {
    return [0x1b, 0x45, on ? 1 : 0]; // ESC E n
  }

  private setEmphasis(on: boolean): number[] {
    return [0x1d, 0x21, on ? 0x11 : 0x00]; // GS ! n (double height + width)
  }

  private setFontSize(size: 'normal' | 'double' | 'large'): number[] {
    const n = size === 'large' ? 0x33 : size === 'double' ? 0x11 : 0x00;
    return [0x1d, 0x21, n]; // GS ! n
  }

  private feedLines(n: number): number[] {
    return [0x1b, 0x64, n]; // ESC d n
  }

  private cutPaper(): number[] {
    return [0x1d, 0x56, 0x01]; // GS V 1 (partial cut)
  }

  private text(str: string): number[] {
    const encoder = new TextEncoder();
    return Array.from(encoder.encode(str));
  }

  private line(str: string): number[] {
    return [...this.text(str), 0x0a]; // text + LF
  }

  private emptyLine(): number[] {
    return [0x0a];
  }

  // ─── Build ESC/POS receipt ──────────────────────────────────

  buildReceipt(sale: Sale, settings: ShopSettings, items: SaleItem[]): number[] {
    const width = settings.thermal_width || 80;
    const maxWidth = width === 58 ? 32 : 42;
    const cmd: number[] = [];

    cmd.push(...this.init());
    cmd.push(...this.setAlign('center'));
    cmd.push(...this.setFontSize('double'));
    cmd.push(...this.setBold(true));
    cmd.push(...this.line(settings.shop_name || 'My Shop'));
    cmd.push(...this.setBold(false));
    cmd.push(...this.setFontSize('normal'));

    if (settings.address) cmd.push(...this.line(settings.address));
    if (settings.phone) cmd.push(...this.line('Phone: ' + settings.phone));
    if (settings.gstin) cmd.push(...this.line('GSTIN: ' + settings.gstin));

    cmd.push(...this.text('-'.repeat(maxWidth)));
    cmd.push(...this.emptyLine());
    cmd.push(...this.setAlign('left'));
    cmd.push(...this.line(`Invoice: ${sale.invoice_number}`));
    cmd.push(...this.line(`Date: ${new Date(sale.created_at).toLocaleString('en-IN')}`));
    if (sale.cashier) cmd.push(...this.line(`Cashier: ${sale.cashier}`));
    cmd.push(...this.line(`Customer: ${sale.customer_name}`));
    cmd.push(...this.text('-'.repeat(maxWidth)));
    cmd.push(...this.emptyLine());

    // Header row
    const hdrItem = this.padRight('Item', maxWidth - 14);
    const hdrQty = this.padLeft('Qty', 4);
    const hdrAmt = this.padLeft('Amt', 8);
    cmd.push(...this.setBold(true));
    cmd.push(...this.line(`${hdrItem}${hdrQty}${hdrAmt}`));
    cmd.push(...this.setBold(false));

    for (const item of items) {
      const name = this.truncate(item.product_name, maxWidth - 14);
      const qty = this.padLeft(item.quantity.toFixed(0), 4);
      const amt = this.padLeft(item.total.toFixed(2), 8);
      cmd.push(...this.line(`${this.padRight(name, maxWidth - 14)}${qty}${amt}`));
    }

    cmd.push(...this.text('-'.repeat(maxWidth)));
    cmd.push(...this.emptyLine());
    cmd.push(...this.line(`${this.padRight('Subtotal', maxWidth - 10)}${this.padLeft(sale.subtotal.toFixed(2), 10)}`));
    if (sale.discount > 0) {
      cmd.push(...this.line(`${this.padRight('Discount', maxWidth - 10)}${this.padLeft('-' + sale.discount.toFixed(2), 10)}`));
    }
    if (sale.tax > 0) {
      cmd.push(...this.line(`${this.padRight('Tax/GST', maxWidth - 10)}${this.padLeft(sale.tax.toFixed(2), 10)}`));
    }
    cmd.push(...this.setBold(true));
    cmd.push(...this.setEmphasis(true));
    cmd.push(...this.line(`${this.padRight('TOTAL', maxWidth - 10)}${this.padLeft((settings.currency || '') + sale.total.toFixed(2), 10)}`));
    cmd.push(...this.setEmphasis(false));
    cmd.push(...this.setBold(false));
    cmd.push(...this.line(`${this.padRight('Paid (' + sale.payment_method + ')', maxWidth - 10)}${this.padLeft(sale.paid.toFixed(2), 10)}`));
    if (sale.balance > 0) {
      cmd.push(...this.line(`${this.padRight('Balance', maxWidth - 10)}${this.padLeft(sale.balance.toFixed(2), 10)}`));
    }

    cmd.push(...this.text('-'.repeat(maxWidth)));
    cmd.push(...this.emptyLine());
    cmd.push(...this.setAlign('center'));
    cmd.push(...this.line(settings.footer_message || 'Thank you!'));
    cmd.push(...this.line('Kasthuri Agency & Mart'));
    cmd.push(...this.feedLines(3));
    cmd.push(...this.cutPaper());

    return cmd;
  }

  // ─── USB Printer (WebUSB) ───────────────────────────────────

  async connectUSB(): Promise<boolean> {
    if (!this.isWebUSBSupported()) {
      this.setState({ status: 'error', error: 'WebUSB is not supported in this browser', connection: 'none' });
      return false;
    }

    this.setState({ status: 'connecting', error: '' });

    try {
      const usb = navigator.usb;
      if (!usb) throw new Error('WebUSB is not supported in this browser');
      const device = await usb.requestDevice({
        filters: [
          { classCode: 7 }, // USB printer class
          { vendorId: 0x04b8 }, // Epson
          { vendorId: 0x0519 }, // Star
          { vendorId: 0x0fe4 }, // Generic POS
          { vendorId: 0x0416 }, // Winbond/Zebra
          { vendorId: 0x0483 }, // STMicro generic
          { vendorId: 0x04dd }, // Seiko
          { vendorId: 0x0c56 }, // Zebra
          { vendorId: 0x154f }, // SNBC
          { vendorId: 0x1659 }, // Custom
        ],
      });

      await device.open();
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }

      // Find the first output endpoint
      let outEndpoint: USBEndpoint | null = null;
      let ifaceNumber = 0;
      for (const config of device.configurations) {
        for (const iface of config.interfaces) {
          for (const ep of iface.alternates[0]?.endpoints ?? []) {
            if (ep.direction === 'out') {
              outEndpoint = ep;
              ifaceNumber = iface.interfaceNumber;
              break;
            }
          }
          if (outEndpoint) break;
        }
        if (outEndpoint) break;
      }

      if (!outEndpoint) {
        // Some printers use interface 0 with a generic out endpoint
        outEndpoint = device.configurations[0]?.interfaces[0]?.alternates[0]?.endpoints.find(
          (ep) => ep.direction === 'out'
        ) ?? null;
        ifaceNumber = device.configurations[0]?.interfaces[0]?.interfaceNumber ?? 0;
      }

      if (!outEndpoint) {
        throw new Error('No output endpoint found on this printer');
      }

      await device.claimInterface(ifaceNumber);

      this.usbDevice = device;
      this.usbOutEndpoint = outEndpoint;
      this.setState({
        connection: 'usb',
        status: 'connected',
        name: device.productName || `USB Printer (${device.vendorId.toString(16)}:${device.productId.toString(16)})`,
        error: '',
      });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'USB connection failed';
      this.setState({ status: 'error', error: msg, connection: 'none' });
      return false;
    }
  }

  // ─── Bluetooth Printer (Web Bluetooth) ──────────────────────

  // Common BLE service UUIDs for thermal printers
  private readonly BLE_SERVICE_UUIDS = [
    '000018f0-0000-1000-8000-00805f9b34fb', // Common POS printer service
    '00001101-0000-1000-8000-00805f9b34fb', // SPP
    '6e400001-b5a3-f393-e0a9-e50e24dcca9e',  // Nordic UART-like
    '0000fee7-0000-1000-8000-00805f9b34fb',  // Some POS printers
  ];

  async connectBluetooth(): Promise<boolean> {
    if (!this.isBluetoothSupported()) {
      this.setState({ status: 'error', error: 'Web Bluetooth is not supported in this browser', connection: 'none' });
      return false;
    }

    this.setState({ status: 'connecting', error: '' });

    try {
      const bluetooth = navigator.bluetooth;
      if (!bluetooth) throw new Error('Web Bluetooth is not supported in this browser');
      const device = await bluetooth.requestDevice({
        filters: this.BLE_SERVICE_UUIDS.map((uuid) => ({ services: [uuid] })),
        optionalServices: this.BLE_SERVICE_UUIDS,
      });

      this.bluetoothDevice = device;
      device.addEventListener('gattserverdisconnected', () => {
        this.setState({ connection: 'none', status: 'disconnected', name: '' });
      });

      const server = await device.gatt?.connect();
      if (!server) throw new Error('Failed to connect to GATT server');

      // Try each service until we find a writable characteristic
      let characteristic: BluetoothRemoteGATTCharacteristic | null = null;
      for (const serviceUuid of this.BLE_SERVICE_UUIDS) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          const characteristics = await service.getCharacteristics();
          for (const ch of characteristics) {
            if (ch.properties.writeWithoutResponse || ch.properties.write) {
              characteristic = ch;
              break;
            }
          }
          if (characteristic) break;
        } catch {
          // Service not found, try next
        }
      }

      if (!characteristic) {
        // Fallback: search all services
        const services = await server.getPrimaryServices();
        for (const service of services) {
          const chars = await service.getCharacteristics();
          for (const ch of chars) {
            if (ch.properties.writeWithoutResponse || ch.properties.write) {
              characteristic = ch;
              break;
            }
          }
          if (characteristic) break;
        }
      }

      if (!characteristic) {
        throw new Error('No writable characteristic found on this printer');
      }

      this.bluetoothCharacteristic = characteristic;
      this.setState({
        connection: 'bluetooth',
        status: 'connected',
        name: device.name || 'Bluetooth Printer',
        error: '',
      });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bluetooth connection failed';
      this.setState({ status: 'error', error: msg, connection: 'none' });
      return false;
    }
  }

  // ─── Send data to printer ───────────────────────────────────

  async print(data: number[]): Promise<boolean> {
    if (this.state.connection === 'usb' && this.usbDevice && this.usbOutEndpoint) {
      try {
        const chunkSize = this.usbOutEndpoint.packetSize || 512;
        const bytes = new Uint8Array(data);
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          const chunk = bytes.slice(offset, offset + chunkSize);
          await this.usbDevice.transferOut(this.usbOutEndpoint.endpointNumber, chunk);
        }
        return true;
      } catch (err) {
        this.setState({ status: 'error', error: err instanceof Error ? err.message : 'Print failed' });
        return false;
      }
    }

    if (this.state.connection === 'bluetooth' && this.bluetoothCharacteristic) {
      try {
        const ch = this.bluetoothCharacteristic;
        const bytes = new Uint8Array(data);
        const chunkSize = ch.properties.writeWithoutResponse ? 180 : 20;

        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          const chunk = bytes.slice(offset, offset + chunkSize);
          if (ch.properties.writeWithoutResponse) {
            await ch.writeValueWithoutResponse(chunk);
          } else {
            await ch.writeValueWithResponse(chunk);
          }
          // Small delay between BLE chunks for reliability
          await new Promise((r) => setTimeout(r, 20));
        }
        return true;
      } catch (err) {
        this.setState({ status: 'error', error: err instanceof Error ? err.message : 'Print failed' });
        return false;
      }
    }

    return false;
  }

  async printReceipt(sale: Sale, settings: ShopSettings, items: SaleItem[]): Promise<boolean> {
    const data = this.buildReceipt(sale, settings, items);
    return this.print(data);
  }

  async printTest(): Promise<boolean> {
    const testData: number[] = [
      ...this.init(),
      ...this.setAlign('center'),
      ...this.setFontSize('double'),
      ...this.setBold(true),
      ...this.line('TEST PRINT'),
      ...this.setBold(false),
      ...this.setFontSize('normal'),
      ...this.text('-'.repeat(32)),
      ...this.emptyLine(),
      ...this.setAlign('left'),
      ...this.line('Item 1          Qty 1   100.00'),
      ...this.line('Item 2          Qty 2   200.00'),
      ...this.text('-'.repeat(32)),
      ...this.emptyLine(),
      ...this.setBold(true),
      ...this.line('Total                   300.00'),
      ...this.setBold(false),
      ...this.text('-'.repeat(32)),
      ...this.emptyLine(),
      ...this.setAlign('center'),
      ...this.line('Printer is working!'),
      ...this.feedLines(3),
      ...this.cutPaper(),
    ];
    return this.print(testData);
  }

  // ─── Disconnect ─────────────────────────────────────────────

  async disconnect(): Promise<void> {
    if (this.usbDevice) {
      try {
        await this.usbDevice.close();
      } catch { /* ignore */ }
      this.usbDevice = null;
      this.usbOutEndpoint = null;
    }
    if (this.bluetoothDevice && this.bluetoothDevice.gatt?.connected) {
      try {
        this.bluetoothDevice.gatt.disconnect();
      } catch { /* ignore */ }
    }
    this.bluetoothDevice = null;
    this.bluetoothCharacteristic = null;
    this.setState({ connection: 'none', status: 'disconnected', name: '', error: '' });
  }

  // ─── String helpers ─────────────────────────────────────────

  private padRight(text: string, width: number): string {
    const s = text.substring(0, width);
    return s + ' '.repeat(Math.max(0, width - s.length));
  }

  private padLeft(text: string, width: number): string {
    const s = text.substring(text.length > width ? text.length - width : 0);
    return ' '.repeat(Math.max(0, width - s.length)) + s;
  }

  private truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max - 1) + '\u2026' : text;
  }
}

export const printerManager = new PrinterManager();
