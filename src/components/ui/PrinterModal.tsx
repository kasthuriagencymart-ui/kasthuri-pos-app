import { useState, useEffect } from 'react';
import { Usb, Bluetooth, Printer, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { printerManager, type PrinterState } from '@/lib/printer';
import { Modal } from '@/components/ui/Modal';
import { printHTML } from '@/lib/utils';

interface PrinterModalProps {
  open: boolean;
  onClose: () => void;
  onTestPrint?: (type: 'thermal' | 'a4') => void;
}

export function PrinterModal({ open, onClose, onTestPrint }: PrinterModalProps) {
  const [state, setState] = useState<PrinterState>(printerManager.getState());
  const [usbSupported] = useState(printerManager.isWebUSBSupported());
  const [btSupported] = useState(printerManager.isBluetoothSupported());
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    return printerManager.subscribe(setState);
  }, []);

  const handleUSB = async () => {
    const ok = await printerManager.connectUSB();
    if (ok && printerManager.getState().status === 'connected') {
      setTimeout(() => {
        printerManager.printTest();
      }, 500);
    }
  };

  const handleBluetooth = async () => {
    const ok = await printerManager.connectBluetooth();
    if (ok) {
      setTimeout(() => {
        printerManager.printTest();
      }, 500);
    }
  };

  const handleBrowserPrint = () => {
    onClose();
    if (onTestPrint) {
      onTestPrint('thermal');
    } else {
      printHTML('<div style="font-family: monospace; padding: 20px;"><h2>Test Print</h2><p>Select a printer and click print.</p></div>');
    }
  };

  const handleDisconnect = async () => {
    await printerManager.disconnect();
  };

  const handleTestPrint = async () => {
    setTesting(true);
    await printerManager.printTest();
    setTimeout(() => setTesting(false), 2000);
  };

  const statusBadge = () => {
    if (state.status === 'connected') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" /> Connected
        </span>
      );
    }
    if (state.status === 'connecting') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting...
        </span>
      );
    }
    if (state.status === 'error') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium">
          <AlertCircle className="w-3.5 h-3.5" /> Error
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
        Disconnected
      </span>
    );
  };

  const ConnectionCard = ({
    icon: Icon,
    title,
    description,
    supported,
    onConnect,
    active,
  }: {
    icon: typeof Usb;
    title: string;
    description: string;
    supported: boolean;
    onConnect: () => void;
    active: boolean;
  }) => (
    <div
      className={`rounded-xl border-2 p-4 transition-all ${
        active ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
        }`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-gray-900 text-sm">{title}</h4>
            {!supported && (
              <span className="text-[10px] text-gray-400 font-medium">Not supported</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          {active && state.name && (
            <p className="text-xs text-blue-600 font-medium mt-1 truncate">{state.name}</p>
          )}
          {supported && !active && (
            <button
              onClick={onConnect}
              className="mt-2.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800"
            >
              Connect
            </button>
          )}
          {active && (
            <button
              onClick={handleDisconnect}
              className="mt-2.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Printer Connection" size="md">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Status</span>
          {statusBadge()}
        </div>

        {state.error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-700">{state.error}</p>
          </div>
        )}

        <div className="space-y-3">
          <ConnectionCard
            icon={Usb}
            title="USB Thermal Printer"
            description="Connect via USB cable. Requires Chrome or Edge browser."
            supported={usbSupported}
            onConnect={handleUSB}
            active={state.connection === 'usb'}
          />
          <ConnectionCard
            icon={Bluetooth}
            title="Bluetooth Printer"
            description="Pair wirelessly with a Bluetooth thermal printer."
            supported={btSupported}
            onConnect={handleBluetooth}
            active={state.connection === 'bluetooth'}
          />
          <ConnectionCard
            icon={Printer}
            title="Browser / System Printer"
            description="Use your system's print dialog. Works on all devices."
            supported={true}
            onConnect={handleBrowserPrint}
            active={false}
          />
        </div>

        {state.status === 'connected' && (
          <button
            onClick={handleTestPrint}
            disabled={testing}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {testing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Printing test...</>
            ) : (
              <><Printer className="w-4 h-4" /> Print Test Receipt</>
            )}
          </button>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs text-amber-700">
            <strong>Tip:</strong> For USB and Bluetooth printing, use Chrome or Edge on desktop, or Chrome on Android. Safari and iOS do not support direct printer connections — use the Browser/System printer option instead.
          </p>
        </div>
      </div>
    </Modal>
  );
}
