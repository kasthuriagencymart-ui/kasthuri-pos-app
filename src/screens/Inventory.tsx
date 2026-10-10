import { useEffect, useState } from 'react';
import { Search, AlertTriangle, Calendar, Package, Plus, Minus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Product, StockAdjustment } from '@/types';

export function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'stock' | 'adjustments' | 'alerts'>('stock');
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [prodRes, adjRes] = await Promise.all([
      supabase.from('products').select('*, category:categories(*)').order('name'),
      supabase.from('stock_adjustments').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    setProducts(prodRes.data as Product[] ?? []);
    setAdjustments(adjRes.data as StockAdjustment[] ?? []);
  };

  const filtered = products.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));
  const lowStock = products.filter((p) => p.stock <= p.min_stock);
  const expiringSoon = products.filter((p) => {
    if (!p.expiry_date) return false;
    const days = (new Date(p.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 30 && days >= 0;
  });
  const expired = products.filter((p) => p.expiry_date && new Date(p.expiry_date) < new Date());

  const totalStockValue = products.reduce((s, p) => s + p.stock * p.purchase_price, 0);

  return (
    <div className="p-4 lg:p-8 space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Products" value={String(products.length)} icon={Package} color="blue" />
        <StatCard label="Stock Value" value={formatCurrency(totalStockValue)} icon={Package} color="green" />
        <StatCard label="Low Stock" value={String(lowStock.length)} icon={AlertTriangle} color="amber" />
        <StatCard label="Expiring Soon" value={String(expiringSoon.length + expired.length)} icon={Calendar} color="red" />
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {[
          { id: 'stock', label: 'Stock Overview' },
          { id: 'adjustments', label: 'Adjustments' },
          { id: 'alerts', label: 'Alerts' },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" />
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Product</th>
                    <th className="px-4 py-3 text-right font-medium">Stock</th>
                    <th className="px-4 py-3 text-right font-medium hidden md:table-cell">Min Stock</th>
                    <th className="px-4 py-3 text-right font-medium hidden lg:table-cell">Value</th>
                    <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Batch</th>
                    <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Expiry</th>
                    <th className="px-4 py-3 text-center font-medium">Adjust</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                      <td className={`px-4 py-3 text-right font-medium ${p.stock <= p.min_stock ? 'text-red-600' : 'text-gray-900'}`}>{p.stock} {p.unit}</td>
                      <td className="px-4 py-3 text-right text-gray-500 hidden md:table-cell">{p.min_stock}</td>
                      <td className="px-4 py-3 text-right text-gray-600 hidden lg:table-cell">{formatCurrency(p.stock * p.purchase_price)}</td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{p.batch_number || '-'}</td>
                      <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{p.expiry_date ? formatDate(p.expiry_date) : '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => setAdjustProduct(p)} className="px-3 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100">Adjust</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'adjustments' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {adjustments.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No stock adjustments yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Product</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-right font-medium">Change</th>
                    <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Reason</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {adjustments.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{a.product_name}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{a.type}</span></td>
                      <td className={`px-4 py-3 text-right font-medium ${a.quantity_change > 0 ? 'text-green-600' : 'text-red-600'}`}>{a.quantity_change > 0 ? '+' : ''}{a.quantity_change}</td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{a.reason}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'alerts' && (
        <div className="space-y-5">
          {expired.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-5">
              <h3 className="font-bold text-red-600 mb-3 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Expired Products</h3>
              <div className="space-y-2">
                {expired.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-red-50">
                    <div><p className="font-medium text-gray-900">{p.name}</p><p className="text-xs text-red-600">Expired: {formatDate(p.expiry_date!)}</p></div>
                    <span className="font-bold text-red-600">{p.stock} {p.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {expiringSoon.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-5">
              <h3 className="font-bold text-amber-600 mb-3 flex items-center gap-2"><Calendar className="w-5 h-5" /> Expiring Soon (30 days)</h3>
              <div className="space-y-2">
                {expiringSoon.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50">
                    <div><p className="font-medium text-gray-900">{p.name}</p><p className="text-xs text-amber-600">Expires: {formatDate(p.expiry_date!)}</p></div>
                    <span className="font-bold text-amber-600">{p.stock} {p.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-5">
              <h3 className="font-bold text-amber-600 mb-3 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Low Stock</h3>
              <div className="space-y-2">
                {lowStock.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50">
                    <div><p className="font-medium text-gray-900">{p.name}</p><p className="text-xs text-gray-500">Min: {p.min_stock}</p></div>
                    <span className="font-bold text-red-600">{p.stock} {p.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {expired.length === 0 && expiringSoon.length === 0 && lowStock.length === 0 && (
            <p className="text-center text-gray-400 py-8">No alerts. All stock levels are healthy.</p>
          )}
        </div>
      )}

      {adjustProduct && <AdjustModal product={adjustProduct} onClose={() => setAdjustProduct(null)} onSaved={() => { setAdjustProduct(null); load(); }} />}
    </div>
  );
}

function AdjustModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [type, setType] = useState('adjustment');
  const [change, setChange] = useState(0);
  const [reason, setReason] = useState('');

  const handleSave = async () => {
    if (change === 0) { showToast('Enter a quantity change', 'error'); return; }
    const newStock = product.stock + change;
    if (newStock < 0) { showToast('Stock cannot go below zero', 'error'); return; }

    const { error: adjErr } = await supabase.from('stock_adjustments').insert({
      product_id: product.id,
      product_name: product.name,
      type,
      quantity_change: change,
      reason,
    });
    if (adjErr) { showToast(adjErr.message, 'error'); return; }

    const { error: prodErr } = await supabase.from('products').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', product.id);
    if (prodErr) showToast(prodErr.message, 'error');
    else { showToast('Stock adjusted successfully', 'success'); onSaved(); }
  };

  return (
    <Modal open onClose={onClose} title={`Adjust Stock: ${product.name}`} size="sm">
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-sm text-gray-500">Current Stock</p>
          <p className="text-2xl font-bold text-gray-900">{product.stock} {product.unit}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Adjustment Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none">
            <option value="adjustment">Manual Adjustment</option>
            <option value="damaged">Damaged</option>
            <option value="expired">Expired</option>
            <option value="lost">Lost</option>
            <option value="found">Found</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity Change</label>
          <div className="flex gap-2">
            <button onClick={() => setChange(change - 1)} className="px-3 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200"><Minus className="w-4 h-4" /></button>
            <input type="number" value={change} onChange={(e) => setChange(parseFloat(e.target.value) || 0)} className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-center text-lg font-bold" />
            <button onClick={() => setChange(change + 1)} className="px-3 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200"><Plus className="w-4 h-4" /></button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Use negative for stock out, positive for stock in</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason</label>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for adjustment..." className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" />
        </div>
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-sm text-blue-600">New stock will be: <span className="font-bold">{product.stock + change} {product.unit}</span></p>
        </div>
        <button onClick={handleSave} className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700">Save Adjustment</button>
      </div>
    </Modal>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: typeof Package; color: 'blue' | 'green' | 'amber' | 'red' }) {
  const colors = { blue: 'text-blue-600 bg-blue-50', green: 'text-green-600 bg-green-50', amber: 'text-amber-600 bg-amber-50', red: 'text-red-600 bg-red-50' };
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
