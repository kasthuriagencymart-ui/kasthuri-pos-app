import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Truck, Phone, Mail, MapPin, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatCurrency } from '@/lib/utils';
import type { Supplier } from '@/types';

export function Suppliers() {
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from('suppliers').select('*').order('name');
    setSuppliers(data as Supplier[] ?? []);
  };

  const filtered = suppliers.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.phone.includes(search));
  const totalOutstanding = suppliers.reduce((s, sup) => s + sup.outstanding, 0);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('suppliers').delete().eq('id', deleteId);
    if (error) showToast(error.message, 'error');
    else { showToast('Supplier deleted', 'success'); load(); }
    setDeleteId(null);
  };

  return (
    <div className="p-4 lg:p-8 space-y-5">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center"><Wallet className="w-5 h-5 text-orange-600" /></div>
        <div><p className="text-xs text-gray-500">Total Outstanding to Suppliers</p><p className="text-xl font-bold text-orange-600">{formatCurrency(totalOutstanding)}</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suppliers..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" />
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Supplier
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12"><Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-400">No suppliers found</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center font-bold text-orange-600">{s.name.charAt(0).toUpperCase()}</div>
                  <div><p className="font-semibold text-gray-900">{s.name}</p>{s.phone && <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone}</p>}</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditing(s); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteId(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {s.email && <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Mail className="w-3 h-3" />{s.email}</p>}
              {s.address && <p className="text-xs text-gray-500 flex items-center gap-1 mb-2"><MapPin className="w-3 h-3" />{s.address}</p>}
              <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                <span className="text-xs text-gray-500">Outstanding</span>
                <span className={`text-sm font-bold ${s.outstanding > 0 ? 'text-orange-600' : 'text-green-600'}`}>{formatCurrency(s.outstanding)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <SupplierForm supplier={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Supplier" message="Delete this supplier? This cannot be undone." confirmLabel="Delete" danger />
    </div>
  );
}

function SupplierForm({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: supplier?.name ?? '', phone: supplier?.phone ?? '', email: supplier?.email ?? '', address: supplier?.address ?? '', gstin: supplier?.gstin ?? '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    const { error } = supplier ? await supabase.from('suppliers').update(form).eq('id', supplier.id) : await supabase.from('suppliers').insert(form);
    if (error) showToast(error.message, 'error');
    else { showToast(supplier ? 'Supplier updated' : 'Supplier added', 'success'); onSaved(); }
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title={supplier ? 'Edit Supplier' : 'Add Supplier'}>
      <div className="space-y-3">
        {[['name', 'Name *'], ['phone', 'Phone'], ['email', 'Email'], ['address', 'Address'], ['gstin', 'GSTIN']].map(([key, label]) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input type="text" value={String(form[key as keyof typeof form])} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" />
          </div>
        ))}
        <button onClick={handleSave} disabled={saving} className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </Modal>
  );
}
