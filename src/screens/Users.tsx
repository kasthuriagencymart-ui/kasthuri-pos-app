import { useEffect, useState } from 'react';
import { UserCog, Shield, Crown, User as UserIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { formatDate } from '@/lib/utils';
import type { AppUser, UserRole } from '@/types';

export function Users() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from('app_users').select('*').order('created_at', { ascending: false });
    setUsers(data as AppUser[] ?? []);
  };

  const roleConfig: Record<UserRole, { label: string; icon: typeof Crown; color: string; desc: string }> = {
    admin: { label: 'Admin', icon: Crown, color: 'text-blue-600 bg-blue-50', desc: 'Full access to all modules' },
    manager: { label: 'Manager', icon: Shield, color: 'text-green-600 bg-green-50', desc: 'Management and reports' },
    cashier: { label: 'Cashier', icon: UserIcon, color: 'text-orange-600 bg-orange-50', desc: 'Billing and customers' },
  };

  const updateRole = async (userId: string, role: UserRole) => {
    const { error } = await supabase.from('app_users').update({ role }).eq('id', userId);
    if (error) showToast(error.message, 'error');
    else { showToast('Role updated', 'success'); load(); }
  };

  return (
    <div className="p-4 lg:p-8 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(Object.keys(roleConfig) as UserRole[]).map((role) => {
          const cfg = roleConfig[role];
          const Icon = cfg.icon;
          const count = users.filter((u) => u.role === role).length;
          return (
            <div key={role} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{cfg.label}</p>
                  <p className="text-xs text-gray-500">{cfg.desc}</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900">Team Members</h3>
        <button onClick={() => setShowInvite(true)} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 flex items-center gap-2 text-sm">
          <UserCog className="w-4 h-4" /> Invite User
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {users.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No users found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Joined</th>
                  <th className="px-4 py-3 text-center font-medium">Change Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => {
                  const cfg = roleConfig[u.role];
                  const Icon = cfg.icon;
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600">{u.full_name.charAt(0).toUpperCase()}</div>
                          <span className="font-medium text-gray-900">{u.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1 ${cfg.color}`}><Icon className="w-3 h-3" /> {cfg.label}</span></td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{formatDate(u.created_at)}</td>
                      <td className="px-4 py-3 text-center">
                        <select value={u.role} onChange={(e) => updateRole(u.id, e.target.value as UserRole)} className="px-2 py-1 rounded-lg border border-gray-200 text-xs focus:border-blue-500 outline-none">
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="cashier">Cashier</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('cashier');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!email || !fullName || !password) { showToast('Fill all fields', 'error'); return; }
    setSaving(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });
    if (error) { showToast(error.message, 'error'); setSaving(false); return; }
    if (data.user) {
      await supabase.from('app_users').insert({ user_id: data.user.id, full_name: fullName, role });
    }
    showToast('User created successfully', 'success');
    onClose();
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title="Create New User">
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none">
            <option value="admin">Admin (Full Access)</option>
            <option value="manager">Manager (Management & Reports)</option>
            <option value="cashier">Cashier (Billing & Customers)</option>
          </select>
        </div>
        <button onClick={handleCreate} disabled={saving} className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? 'Creating...' : 'Create User'}</button>
      </div>
    </Modal>
  );
}
