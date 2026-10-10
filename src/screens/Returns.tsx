import { useEffect, useState } from 'react';
import { Search, Undo2, Eye, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { SalesReturn, SalesReturnItem, PurchaseReturn, PurchaseReturnItem, Sale, SaleItem, Purchase, PurchaseItem } from '@/types';

export function Returns() {
  const [tab, setTab] = useState<'sales' | 'purchase'>('sales');
  const [salesReturns, setSalesReturns] = useState<SalesReturn[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [viewReturn, setViewReturn] = useState<{ header: SalesReturn | PurchaseReturn; items: SalesReturnItem[] | PurchaseReturnItem[]; type: 'sales' | 'purchase' } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [sr, pr] = await Promise.all([
      supabase.from('sales_returns').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('purchase_returns').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    setSalesReturns(sr.data as SalesReturn[] ?? []);
    setPurchaseReturns(pr.data as PurchaseReturn[] ?? []);
  };

  const { showToast } = useToast();

  const list = tab === 'sales' ? salesReturns : purchaseReturns;
  const filtered = list.filter((r) => !search || r.return_number.toLowerCase().includes(search.toLowerCase()));

  const viewDetail = async (r: SalesReturn | PurchaseReturn, type: 'sales' | 'purchase') => {
    const table = type === 'sales' ? 'sales_return_items' : 'purchase_return_items';
    const { data } = await supabase.from(table).select('*').eq('return_id', r.id);
    setViewReturn({ header: r, items: (data as SalesReturnItem[] | PurchaseReturnItem[]) ?? [], type });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const table = tab === 'sales' ? 'sales_returns' : 'purchase_returns';
    const { error } = await supabase.from(table).delete().eq('id', deleteId);
    if (error) showToast(error.message, 'error');
    else { showToast('Return deleted (stock not reversed)', 'success'); load(); }
    setDeleteId(null);
  };

  return (
    <div className="p-4 lg:p-8 space-y-5">
      <div className="flex gap-2 border-b border-gray-200">
        {[{ id: 'sales', label: 'Sales Returns' }, { id: 'purchase', label: 'Purchase Returns' }].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as 'sales' | 'purchase')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t.label}</button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search returns..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" />
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> New {tab === 'sales' ? 'Sales' : 'Purchase'} Return
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12"><Undo2 className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-400">No {tab} returns found</p></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Return #</th>
                  <th className="px-4 py-3 text-left font-medium">{tab === 'sales' ? 'Customer' : 'Supplier'}</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Reason</th>
                  <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Date</th>
                  <th className="px-4 py-3 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.return_number}</td>
                    <td className="px-4 py-3 text-gray-600">{tab === 'sales' ? (r as SalesReturn).customer_name : (r as PurchaseReturn).supplier_name || '-'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(r.total)}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{r.reason || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => viewDetail(r, tab)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteId(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && tab === 'sales' && <SalesReturnForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {showForm && tab === 'purchase' && <PurchaseReturnForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Return" message="Delete this return record? Stock will not be reversed." confirmLabel="Delete" danger />

      <Modal open={!!viewReturn} onClose={() => setViewReturn(null)} title={viewReturn?.header.return_number ?? ''} size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500">{viewReturn?.type === 'sales' ? 'Customer' : 'Supplier'}</p><p className="font-medium text-gray-900">{viewReturn?.type === 'sales' ? ((viewReturn?.header as SalesReturn)?.customer_name ?? '-') : ((viewReturn?.header as PurchaseReturn)?.supplier_name ?? '-')}</p></div>
            <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500">Date</p><p className="font-medium text-gray-900">{viewReturn && formatDate(viewReturn.header.created_at)}</p></div>
          </div>
          {viewReturn?.header.reason && <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500">Reason</p><p className="text-sm text-gray-700">{viewReturn.header.reason}</p></div>}
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500"><tr><th className="px-3 py-2 text-left">Product</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {viewReturn?.items.map((i) => (
                <tr key={i.id}><td className="px-3 py-2">{i.product_name}</td><td className="px-3 py-2 text-right">{i.quantity}</td><td className="px-3 py-2 text-right">{formatCurrency(i.price)}</td><td className="px-3 py-2 text-right font-medium">{formatCurrency(i.total)}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="text-right"><p className="text-xs text-gray-500">Total</p><p className="text-xl font-bold text-blue-600">{formatCurrency(viewReturn?.header.total ?? 0)}</p></div>
        </div>
      </Modal>
    </div>
  );
}

function SalesReturnForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [returnItems, setReturnItems] = useState<{ product_id: string; product_name: string; quantity: number; price: number; total: number }[]>([]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(50).then(({ data }) => setSales(data as Sale[] ?? []));
  }, []);

  const selectSale = async (sale: Sale) => {
    setSelectedSale(sale);
    const { data } = await supabase.from('sale_items').select('*').eq('sale_id', sale.id);
    setReturnItems((data as SaleItem[] ?? []).map((i) => ({ product_id: i.product_id ?? '', product_name: i.product_name, quantity: i.quantity, price: i.price, total: i.total })));
  };

  const updateQty = (idx: number, qty: number) => {
    setReturnItems(returnItems.map((i, j) => j === idx ? { ...i, quantity: qty, total: qty * i.price } : i));
  };

  const total = returnItems.reduce((s, i) => s + i.total, 0);

  const handleSave = async () => {
    if (!selectedSale || returnItems.length === 0) { showToast('Select a sale and items to return', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.rpc('process_sales_return', {
      p_sale_id: selectedSale.id,
      p_customer_id: selectedSale.customer_id,
      p_customer_name: selectedSale.customer_name,
      p_total: total,
      p_reason: reason,
      p_items: returnItems,
    });
    if (error) showToast(error.message, 'error');
    else { showToast('Sales return processed and stock restored', 'success'); onSaved(); }
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title="New Sales Return (Stock In)" size="lg">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Sale</label>
          <select value={selectedSale?.id ?? ''} onChange={(e) => { const s = sales.find((s) => s.id === e.target.value); if (s) selectSale(s); }} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none">
            <option value="">Select a sale...</option>
            {sales.map((s) => <option key={s.id} value={s.id}>{s.invoice_number} - {s.customer_name} - {formatCurrency(s.total)}</option>)}
          </select>
        </div>
        {returnItems.length > 0 && (
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500"><tr><th className="px-3 py-2 text-left">Product</th><th className="px-3 py-2 text-right">Return Qty</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
              <tbody className="divide-y divide-gray-50">
                {returnItems.map((i, idx) => (
                  <tr key={idx}><td className="px-3 py-2">{i.product_name}</td><td className="px-3 py-2 text-right"><input type="number" value={i.quantity} onChange={(e) => updateQty(idx, parseFloat(e.target.value) || 0)} className="w-16 text-right border border-gray-200 rounded px-1 py-0.5" /></td><td className="px-3 py-2 text-right">{formatCurrency(i.price)}</td><td className="px-3 py-2 text-right font-medium">{formatCurrency(i.total)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Reason</label><input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for return..." className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" /></div>
        <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3"><span className="font-medium text-gray-700">Return Total</span><span className="text-xl font-bold text-blue-600">{formatCurrency(total)}</span></div>
        <button onClick={handleSave} disabled={saving} className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? 'Processing...' : 'Process Return'}</button>
      </div>
    </Modal>
  );
}

function PurchaseReturnForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [returnItems, setReturnItems] = useState<{ product_id: string; product_name: string; quantity: number; price: number; total: number }[]>([]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('purchases').select('*').order('created_at', { ascending: false }).limit(50).then(({ data }) => setPurchases(data as Purchase[] ?? []));
  }, []);

  const selectPurchase = async (p: Purchase) => {
    setSelectedPurchase(p);
    const { data } = await supabase.from('purchase_items').select('*').eq('purchase_id', p.id);
    setReturnItems((data as PurchaseItem[] ?? []).map((i) => ({ product_id: i.product_id ?? '', product_name: i.product_name, quantity: i.quantity, price: i.price, total: i.total })));
  };

  const updateQty = (idx: number, qty: number) => setReturnItems(returnItems.map((i, j) => j === idx ? { ...i, quantity: qty, total: qty * i.price } : i));
  const total = returnItems.reduce((s, i) => s + i.total, 0);

  const handleSave = async () => {
    if (!selectedPurchase || returnItems.length === 0) { showToast('Select a purchase and items to return', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.rpc('process_purchase_return', {
      p_purchase_id: selectedPurchase.id,
      p_supplier_id: selectedPurchase.supplier_id,
      p_supplier_name: selectedPurchase.supplier_name,
      p_total: total,
      p_reason: reason,
      p_items: returnItems,
    });
    if (error) showToast(error.message, 'error');
    else { showToast('Purchase return processed and stock removed', 'success'); onSaved(); }
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title="New Purchase Return (Stock Out)" size="lg">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Purchase</label>
          <select value={selectedPurchase?.id ?? ''} onChange={(e) => { const p = purchases.find((p) => p.id === e.target.value); if (p) selectPurchase(p); }} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none">
            <option value="">Select a purchase...</option>
            {purchases.map((p) => <option key={p.id} value={p.id}>{p.invoice_number} - {p.supplier_name} - {formatCurrency(p.total)}</option>)}
          </select>
        </div>
        {returnItems.length > 0 && (
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500"><tr><th className="px-3 py-2 text-left">Product</th><th className="px-3 py-2 text-right">Return Qty</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
              <tbody className="divide-y divide-gray-50">
                {returnItems.map((i, idx) => (
                  <tr key={idx}><td className="px-3 py-2">{i.product_name}</td><td className="px-3 py-2 text-right"><input type="number" value={i.quantity} onChange={(e) => updateQty(idx, parseFloat(e.target.value) || 0)} className="w-16 text-right border border-gray-200 rounded px-1 py-0.5" /></td><td className="px-3 py-2 text-right">{formatCurrency(i.price)}</td><td className="px-3 py-2 text-right font-medium">{formatCurrency(i.total)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Reason</label><input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for return..." className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" /></div>
        <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3"><span className="font-medium text-gray-700">Return Total</span><span className="text-xl font-bold text-blue-600">{formatCurrency(total)}</span></div>
        <button onClick={handleSave} disabled={saving} className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? 'Processing...' : 'Process Return'}</button>
      </div>
    </Modal>
  );
}
