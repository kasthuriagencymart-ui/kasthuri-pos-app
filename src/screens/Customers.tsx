import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Users, Phone, Mail, MapPin, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Customer, Sale } from '@/types';

export function Customers() {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [customerSales, setCustomerSales] = useState<Sale[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from('customers').select('*').order('name');
    setCustomers(data as Customer[] ?? []);
  };

  const filtered = customers.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('customers').delete().eq('id', deleteId);
    if (error) showToast(error.message, 'error');
    else { showToast('Customer deleted', 'success'); load(); }
    setDeleteId(null);
  };

  const viewHistory = async (c: Customer) => {
    setViewCustomer(c);
    const { data } = await supabase.from('sales').select('*').eq('customer_id', c.id).order('created_at', { ascending: false }).limit(20);
    setCustomerSales(data as Sale[] ?? []);
  };

  const totalCredit = customers.reduce((s, c) => s + c.credit_balance, 0);

  return (
    <div className="p-4 lg:p-8 space-y-5">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Wallet className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-xs text-gray-500">Total Credit Outstanding</p><p className="text-xl font-bold text-blue-600">{formatCurrency(totalCredit)}</p></div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" />
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12"><Users className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-400">No customers found</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center font-bold text-blue-600">{c.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    {c.phone && <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditing(c); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {c.email && <p className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Mail className="w-3 h-3" />{c.email}</p>}
              {c.address && <p className="text-xs text-gray-500 flex items-center gap-1 mb-2"><MapPin className="w-3 h-3" />{c.address}</p>}
              <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                <span className={`text-sm font-bold ${c.credit_balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>{formatCurrency(c.credit_balance)}</span>
                <button onClick={() => viewHistory(c)} className="text-xs text-blue-600 font-medium hover:underline">View History</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <CustomerForm customer={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Customer" message="Delete this customer? This cannot be undone." confirmLabel="Delete" danger />

      <Modal open={!!viewCustomer} onClose={() => setViewCustomer(null)} title={viewCustomer?.name ?? ''} size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500">Phone</p><p className="font-medium text-gray-900">{viewCustomer?.phone || '-'}</p></div>
            <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500">Credit Balance</p><p className="font-bold text-orange-600">{formatCurrency(viewCustomer?.credit_balance ?? 0)}</p></div>
          </div>
          <h4 className="font-semibold text-gray-900 pt-2">Purchase History</h4>
          {customerSales.length === 0 ? <p className="text-gray-400 text-sm">No purchases yet</p> : (
            <div className="space-y-2">
              {customerSales.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div><p className="text-sm font-medium text-gray-900">{s.invoice_number}</p><p className="text-xs text-gray-500">{formatDate(s.created_at)} · {s.payment_method}</p></div>
                  <span className="font-bold text-gray-900">{formatCurrency(s.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function CustomerForm({ customer, onClose, onSaved }: { customer: Customer | null; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
    gstin: customer?.gstin ?? '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    const { error } = customer
      ? await supabase.from('customers').update(form).eq('id', customer.id)
      : await supabase.from('customers').insert(form);
    if (error) showToast(error.message, 'error');
    else { showToast(customer ? 'Customer updated' : 'Customer added', 'success'); onSaved(); }
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title={customer ? 'Edit Customer' : 'Add Customer'}>
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
