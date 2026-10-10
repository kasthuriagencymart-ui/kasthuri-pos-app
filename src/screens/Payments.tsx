import { useEffect, useState } from 'react';
import { Plus, Search, Trash2, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Payment, Customer, Supplier } from '@/types';

export function Payments() {
  const { showToast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(100);
    setPayments(data as Payment[] ?? []);
  };

  const filtered = payments.filter((p) => !search || p.party_name.toLowerCase().includes(search.toLowerCase()) || p.payment_method.toLowerCase().includes(search.toLowerCase()));
  const totalIn = payments.filter((p) => p.party_type === 'customer').reduce((s, p) => s + p.amount, 0);
  const totalOut = payments.filter((p) => p.party_type === 'supplier').reduce((s, p) => s + p.amount, 0);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('payments').delete().eq('id', deleteId);
    if (error) showToast(error.message, 'error');
    else { showToast('Payment deleted', 'success'); load(); }
    setDeleteId(null);
  };

  return (
    <div className="p-4 lg:p-8 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center"><ArrowUpRight className="w-5 h-5 text-green-600" /></div>
          <div><p className="text-xs text-gray-500">Received (recent 100)</p><p className="text-lg font-bold text-green-600">{formatCurrency(totalIn)}</p></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center"><ArrowDownRight className="w-5 h-5 text-orange-600" /></div>
          <div><p className="text-xs text-gray-500">Paid (recent 100)</p><p className="text-lg font-bold text-orange-600">{formatCurrency(totalOut)}</p></div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search payments..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" />
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Record Payment
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12"><Wallet className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-400">No payments found</p></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Party</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Method</th>
                  <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Reference</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Date</th>
                  <th className="px-4 py-3 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.party_name}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.party_type === 'customer' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>{p.party_type === 'customer' ? 'Received' : 'Paid'}</span></td>
                    <td className={`px-4 py-3 text-right font-medium ${p.party_type === 'customer' ? 'text-green-600' : 'text-orange-600'}`}>{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell capitalize">{p.payment_method}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{p.reference || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3 text-center"><button onClick={() => setDeleteId(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <PaymentForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Payment" message="Delete this payment record? Ledger balance will not be reversed." confirmLabel="Delete" danger />
    </div>
  );
}

function PaymentForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const [partyType, setPartyType] = useState<'customer' | 'supplier'>('customer');
  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('customers').select('*').order('name'),
      supabase.from('suppliers').select('*').order('name'),
    ]).then(([c, s]) => { setCustomers(c.data as Customer[] ?? []); setSuppliers(s.data as Supplier[] ?? []); });
  }, []);

  const parties = partyType === 'customer' ? customers : suppliers;
  const selectedParty = parties.find((p) => p.id === partyId);

  const handleSave = async () => {
    if (!partyId) { showToast('Select a party', 'error'); return; }
    if (amount <= 0) { showToast('Amount must be greater than 0', 'error'); return; }
    setSaving(true);
    const partyName = (selectedParty as Customer | Supplier).name;
    const { error } = await supabase.from('payments').insert({
      party_type: partyType,
      party_id: partyId,
      party_name: partyName,
      amount,
      payment_method: paymentMethod,
      reference,
      notes,
    });
    if (error) { showToast(error.message, 'error'); setSaving(false); return; }

    // Update ledger balance
    if (partyType === 'customer') {
      await supabase.from('customers').update({ credit_balance: Math.max(0, (selectedParty as Customer).credit_balance - amount) }).eq('id', partyId);
    } else {
      await supabase.from('suppliers').update({ outstanding: Math.max(0, (selectedParty as Supplier).outstanding - amount) }).eq('id', partyId);
    }

    showToast('Payment recorded successfully', 'success');
    onSaved();
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title="Record Payment">
      <div className="space-y-3">
        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
          <button onClick={() => { setPartyType('customer'); setPartyId(''); }} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${partyType === 'customer' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>From Customer</button>
          <button onClick={() => { setPartyType('supplier'); setPartyId(''); }} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${partyType === 'supplier' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'}`}>To Supplier</button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{partyType === 'customer' ? 'Customer' : 'Supplier'}</label>
          <select value={partyId} onChange={(e) => setPartyId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none">
            <option value="">Select...</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {partyType === 'customer' ? `(Credit: ${formatCurrency((p as Customer).credit_balance)})` : `(Outstanding: ${formatCurrency((p as Supplier).outstanding)})`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
          <input type="number" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-lg font-semibold" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none">
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="bank">Bank Transfer</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reference (optional)</label>
          <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction ID, cheque no..." className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" />
        </div>
        <button onClick={handleSave} disabled={saving} className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? 'Saving...' : 'Record Payment'}</button>
      </div>
    </Modal>
  );
}
