import { useEffect, useState } from 'react';
import { Plus, Search, Trash2, Truck, Eye, ShoppingCart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Purchase, PurchaseItem, Product, Supplier } from '@/types';

export function Purchases() {
  const { showToast } = useToast();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [viewPurchase, setViewPurchase] = useState<Purchase | null>(null);
  const [viewItems, setViewItems] = useState<PurchaseItem[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from('purchases').select('*').order('created_at', { ascending: false }).limit(100);
    setPurchases(data as Purchase[] ?? []);
  };

  const filtered = purchases.filter((p) => !search || p.invoice_number.toLowerCase().includes(search.toLowerCase()) || p.supplier_name.toLowerCase().includes(search.toLowerCase()));

  const viewDetail = async (p: Purchase) => {
    setViewPurchase(p);
    const { data } = await supabase.from('purchase_items').select('*').eq('purchase_id', p.id);
    setViewItems(data as PurchaseItem[] ?? []);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('purchases').delete().eq('id', deleteId);
    if (error) showToast(error.message, 'error');
    else { showToast('Purchase deleted (stock not reversed)', 'success'); load(); }
    setDeleteId(null);
  };

  const totalPurchases = purchases.reduce((s, p) => s + p.total, 0);

  return (
    <div className="p-4 lg:p-8 space-y-5">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center"><Truck className="w-5 h-5 text-cyan-600" /></div>
        <div><p className="text-xs text-gray-500">Total Purchases (recent 100)</p><p className="text-xl font-bold text-cyan-600">{formatCurrency(totalPurchases)}</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search purchases..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" />
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Purchase
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12"><Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-400">No purchases found</p></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Invoice</th>
                  <th className="px-4 py-3 text-left font-medium">Supplier</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium hidden md:table-cell">Paid</th>
                  <th className="px-4 py-3 text-right font-medium hidden md:table-cell">Balance</th>
                  <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Date</th>
                  <th className="px-4 py-3 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.invoice_number}</td>
                    <td className="px-4 py-3 text-gray-600">{p.supplier_name || '-'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(p.total)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">{formatCurrency(p.paid)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">{formatCurrency(p.balance)}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => viewDetail(p)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteId(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <PurchaseForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Purchase" message="Delete this purchase record? Stock will not be reversed." confirmLabel="Delete" danger />

      <Modal open={!!viewPurchase} onClose={() => setViewPurchase(null)} title={viewPurchase?.invoice_number ?? ''} size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500">Supplier</p><p className="font-medium text-gray-900">{viewPurchase?.supplier_name || '-'}</p></div>
            <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500">Date</p><p className="font-medium text-gray-900">{viewPurchase && formatDate(viewPurchase.created_at)}</p></div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500"><tr><th className="px-3 py-2 text-left">Product</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {viewItems.map((i) => (
                <tr key={i.id}><td className="px-3 py-2">{i.product_name}</td><td className="px-3 py-2 text-right">{i.quantity}</td><td className="px-3 py-2 text-right">{formatCurrency(i.price)}</td><td className="px-3 py-2 text-right font-medium">{formatCurrency(i.total)}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end gap-6 pt-2">
            <div className="text-right"><p className="text-xs text-gray-500">Subtotal</p><p className="font-medium">{formatCurrency(viewPurchase?.subtotal ?? 0)}</p></div>
            <div className="text-right"><p className="text-xs text-gray-500">Tax</p><p className="font-medium">{formatCurrency(viewPurchase?.tax ?? 0)}</p></div>
            <div className="text-right"><p className="text-xs text-gray-500">Total</p><p className="font-bold text-blue-600">{formatCurrency(viewPurchase?.total ?? 0)}</p></div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function PurchaseForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState<{ product_id: string; product_name: string; quantity: number; price: number; total: number }[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('suppliers').select('*').order('name'),
    ]).then(([p, s]) => { setProducts(p.data as Product[] ?? []); setSuppliers(s.data as Supplier[] ?? []); });
  }, []);

  const addProduct = (p: Product) => {
    const existing = items.find((i) => i.product_id === p.id);
    if (existing) {
      setItems(items.map((i) => i.product_id === p.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price } : i));
    } else {
      setItems([...items, { product_id: p.id, product_name: p.name, quantity: 1, price: p.purchase_price, total: p.purchase_price }]);
    }
  };

  const updateItem = (idx: number, key: 'quantity' | 'price', val: number) => {
    setItems(items.map((i, j) => j === idx ? { ...i, [key]: val, total: (key === 'quantity' ? val : i.quantity) * (key === 'price' ? val : i.price) } : i));
  };

  const removeItem = (idx: number) => setItems(items.filter((_, j) => j !== idx));

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const filteredProducts = products.filter((p) => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()));

  const handleSave = async () => {
    if (items.length === 0) { showToast('Add at least one product', 'error'); return; }
    setSaving(true);
    const supplier = suppliers.find((s) => s.id === supplierId);
    const { error } = await supabase.rpc('process_purchase', {
      p_supplier_id: supplierId || null,
      p_supplier_name: supplier?.name ?? '',
      p_subtotal: subtotal,
      p_discount: 0,
      p_tax: 0,
      p_total: subtotal,
      p_paid: subtotal,
      p_balance: 0,
      p_payment_method: 'cash',
      p_notes: '',
      p_items: items,
    });
    if (error) showToast(error.message, 'error');
    else { showToast('Purchase recorded and stock updated', 'success'); onSaved(); }
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title="New Purchase (Stock In)" size="xl">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none">
            <option value="">No Supplier</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search products to add..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 outline-none text-sm" />
          </div>
          <div className="max-h-32 overflow-y-auto flex flex-wrap gap-1.5 mb-3">
            {filteredProducts.slice(0, 12).map((p) => (
              <button key={p.id} onClick={() => addProduct(p)} className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 flex items-center gap-1">
                <Plus className="w-3 h-3" /> {p.name}
              </button>
            ))}
          </div>
        </div>

        {items.length > 0 && (
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500"><tr><th className="px-3 py-2 text-left">Product</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2"></th></tr></thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((i, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2">{i.product_name}</td>
                    <td className="px-3 py-2 text-right"><input type="number" value={i.quantity} onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-16 text-right border border-gray-200 rounded px-1 py-0.5" /></td>
                    <td className="px-3 py-2 text-right"><input type="number" value={i.price} onChange={(e) => updateItem(idx, 'price', parseFloat(e.target.value) || 0)} className="w-20 text-right border border-gray-200 rounded px-1 py-0.5" /></td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(i.total)}</td>
                    <td className="px-3 py-2 text-center"><button onClick={() => removeItem(idx)} className="text-red-500"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
          <span className="font-medium text-gray-700">Total</span>
          <span className="text-xl font-bold text-blue-600">{formatCurrency(subtotal)}</span>
        </div>

        <button onClick={handleSave} disabled={saving} className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
          <ShoppingCart className="w-4 h-4" /> {saving ? 'Saving...' : 'Record Purchase'}
        </button>
      </div>
    </Modal>
  );
}
