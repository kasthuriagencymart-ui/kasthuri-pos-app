import { Save, Printer, Store, FileText, Usb, Bluetooth } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { PrinterModal } from '@/components/ui/PrinterModal';
import { printHTML } from '@/lib/utils';
import { printerManager } from '@/lib/printer';
import { useEffect, useState } from 'react';
import type { ShopSettings as SettingsType } from '@/types';

export function Settings() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPrinter, setShowPrinter] = useState(false);
  const [printerState, setPrinterState] = useState(printerManager.getState());

  useEffect(() => {
    return printerManager.subscribe(setPrinterState);
  }, []);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data, error } = await supabase
      .from('shop_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      showToast(error.message, 'error');
      setLoading(false);
      return;
    }

    if (data) {
      setSettings(data as SettingsType);
    } else {
      const { data: newSettings, error: createError } = await supabase
        .from('shop_settings')
        .insert({ shop_name: 'Kasthuri Agency & Mart' })
        .select('*')
        .maybeSingle();
      if (createError) showToast(createError.message, 'error');
      setSettings(newSettings as SettingsType | null);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const { data: savedSettings, error } = await supabase
      .from('shop_settings')
      .update({
        shop_name: settings.shop_name,
        address: settings.address,
        phone: settings.phone,
        gstin: settings.gstin,
        logo_url: settings.logo_url,
        currency: settings.currency,
        thermal_width: settings.thermal_width,
        footer_message: settings.footer_message,
        invoice_prefix: settings.invoice_prefix,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id)
      .select('*')
      .maybeSingle();
    if (error) {
      showToast(error.message, 'error');
    } else if (savedSettings) {
      setSettings(savedSettings as SettingsType);
      showToast('Settings saved successfully', 'success');
    } else {
      showToast('Settings could not be saved', 'error');
    }
    setSaving(false);
  };

  const testPrint = async () => {
    if (printerState.status === 'connected' && (printerState.connection === 'usb' || printerState.connection === 'bluetooth')) {
      const ok = await printerManager.printTest();
      if (!ok) showToast('Printer error. Using browser print.', 'error');
    } else {
      const testHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 400px;">
        <h2 style="color: #1e40af;">Test Print</h2>
        <p>If you can see this, your printer is working correctly!</p>
        <p>Thermal width: ${settings?.thermal_width ?? 80}mm</p>
        <p>Shop: ${settings?.shop_name ?? 'N/A'}</p>
        <pre style="font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.3; border: 1px dashed #ccc; padding: 10px; margin-top: 10px;">
${'-'.repeat(32)}
    TEST RECEIPT
${'-'.repeat(32)}
Item 1          Qty 1   \u20b9100.00
Item 2          Qty 2   \u20b9200.00
${'-'.repeat(32)}
Total                   \u20b9300.00
${'-'.repeat(32)}
Thank you for testing!
        </pre>
      </div>`;
      printHTML(testHtml);
    }
  };

  if (loading) return <div className="p-6 text-gray-500">Loading settings...</div>;
  if (!settings) return null;

  const field = (key: keyof SettingsType, label: string, type = 'text') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={String(settings[key] ?? '')}
        onChange={(e) => setSettings({ ...settings, [key]: type === 'number' ? parseInt(e.target.value) || 0 : e.target.value })}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
      />
    </div>
  );

  return (
    <div className="p-4 lg:p-8 space-y-5">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Store className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-gray-900">Shop Information</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {field('shop_name', 'Shop Name')}
          {field('phone', 'Phone Number')}
          {field('gstin', 'GSTIN')}
          {field('currency', 'Currency Symbol')}
          {field('invoice_prefix', 'Invoice Prefix')}
        </div>
        <div className="mt-4">
          <ImageUpload
            value={settings.logo_url}
            onChange={(url) => setSettings({ ...settings, logo_url: url })}
            label="Shop Logo"
            shape="rounded"
            size="md"
          />
        </div>
        <div className="mt-3">{field('address', 'Address')}</div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Printer className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-gray-900">Printer Settings</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Thermal Printer Width</label>
            <select
              value={settings.thermal_width}
              onChange={(e) => setSettings({ ...settings, thermal_width: parseInt(e.target.value) })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
            >
              <option value={58}>58mm (small)</option>
              <option value={80}>80mm (standard)</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Printer Connection</label>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPrinter(true)}
                className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors text-sm ${
                  printerState.status === 'connected'
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {printerState.status === 'connected' ? (
                  <><Bluetooth className="w-4 h-4" /> {printerState.connection === 'usb' ? 'USB Connected' : 'BT Connected'}</>
                ) : (
                  <><Usb className="w-4 h-4" /> Connect Printer</>
                )}
              </button>
              <button onClick={testPrint} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 flex items-center gap-2 text-sm">
                <Printer className="w-4 h-4" /> Test Print
              </button>
            </div>
            {printerState.name && printerState.status === 'connected' && (
              <p className="text-xs text-green-600">{printerState.name}</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-gray-900">Receipt Footer</h3>
        </div>
        {field('footer_message', 'Footer Message (printed on receipts)')}
      </div>

      <button onClick={handleSave} disabled={saving} className="w-full lg:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
        <Save className="w-5 h-5" /> {saving ? 'Saving...' : 'Save Settings'}
      </button>

      <PrinterModal open={showPrinter} onClose={() => setShowPrinter(false)} />
    </div>
  );
}
