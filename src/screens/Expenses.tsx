import { useEffect, useState } from 'react';
import { Plus, Search, Trash2, Receipt, Edit2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatCurrency, formatDate, startOfMonthISO } from '@/lib/utils';
import type { Expense } from '@/types';

const EXPENSE_CATEGORIES = ['Rent', 'Electricity', 'Salaries', 'Transport', 'Maintenance', 'Marketing', 'Supplies', 'Taxes', 'Miscellaneous'];

export function Expenses() {
  const { showToast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from('expenses').select('*').order('created_at', { ascending: false }).limit(100);
    setExpenses(data as Expense[] ?? []);
  };

  const filtered = expenses.filter((e) => !search || e.category.toLowerCase().includes(search.toLowerCase()) || e.description.toLowerCase().includes(search.toLowerCase()));
  const monthTotal = expenses.filter((e) => e.created_at >= startOfMonthISO()).reduce((s, e) => s + e.amount, 0);
  const totalTotal = expenses.reduce((s, e) => s + e.amount, 0);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('expenses').delete().eq('id', deleteId);
    if (error) showToast(error.message, 'error');
    else { showToast('Expense deleted', 'success'); load(); }
    setDeleteId(null);
  };

  return (
    <div className="p-4 lg:p-8 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center"><Receipt className="w-5 h-5 text-orange-600" /></div>
          <div><p className="text-xs text-gray-500">This Month</p><p className="text-lg font-bold text-orange-600">{formatCurrency(monthTotal)}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center"><Receipt className="w-5 h-5 text-gray-600" /></div>
          <div><p className="text-xs text-gray-500">Total (recent 100)</p><p className="text-lg font-bold text-gray-900">{formatCurrency(totalTotal)}</p></div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search expenses..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" />
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12"><Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-400">No expenses found</p></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Description</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Method</th>
                  <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Date</th>
                  <th className="px-4 py-3 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">{e.category}</span></td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{e.description || '-'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(e.amount)}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell capitalize">{e.payment_method}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{formatDate(e.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setEditing(e); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteId(e.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <ExpenseForm expense={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Expense" message="Delete this expense record?" confirmLabel="Delete" danger />
    </div>
  );
}

function ExpenseForm({ expense, onClose, onSaved }: { expense: Expense | null; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    category: expense?.category ?? 'General',
    description: expense?.description ?? '',
    amount: expense?.amount ?? 0,
    payment_method: expense?.payment_method ?? 'cash',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (form.amount <= 0) { showToast('Amount must be greater than 0', 'error'); return; }
    setSaving(true);
    const { error } = expense
      ? await supabase.from('expenses').update(form).eq('id', expense.id)
      : await supabase.from('expenses').insert(form);
    if (error) showToast(error.message, 'error');
    else { showToast(expense ? 'Expense updated' : 'Expense added', 'success'); onSaved(); }
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title={expense ? 'Edit Expense' : 'Add Expense'}>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none">
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description..." className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
          <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-lg font-semibold" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
          <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none">
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="bank">Bank Transfer</option>
          </select>
        </div>
        <button onClick={handleSave} disabled={saving} className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </Modal>
  );
}
