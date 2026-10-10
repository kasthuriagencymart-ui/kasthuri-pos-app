import { useEffect, useState } from 'react';
import { ScrollText, Search, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDateTime, downloadCSV, todayISO } from '@/lib/utils';
import type { AuditLog } from '@/types';

export function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
    setLogs(data as AuditLog[] ?? []);
    setLoading(false);
  };

  const filtered = logs.filter((l) => !search || l.action.toLowerCase().includes(search.toLowerCase()) || l.entity.toLowerCase().includes(search.toLowerCase()) || l.actor.toLowerCase().includes(search.toLowerCase()));

  const handleExport = () => {
    if (filtered.length === 0) return;
    downloadCSV(`audit_logs_${todayISO()}.csv`, ['Date', 'Actor', 'Action', 'Entity', 'Details'], filtered.map((l) => [formatDateTime(l.created_at), l.actor, l.action, l.entity, JSON.stringify(l.details)]));
  };

  const actionColors: Record<string, string> = {
    CREATE_SALE: 'bg-green-50 text-green-700',
    CREATE_PURCHASE: 'bg-blue-50 text-blue-700',
    CREATE_SALES_RETURN: 'bg-orange-50 text-orange-700',
    CREATE_PURCHASE_RETURN: 'bg-red-50 text-red-700',
  };

  return (
    <div className="p-4 lg:p-8 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search audit logs..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" />
        </div>
        <button onClick={handleExport} disabled={filtered.length === 0} className="px-4 py-2.5 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 flex items-center gap-2 disabled:opacity-50">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading audit logs...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12"><ScrollText className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-400">No audit logs found</p></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Date/Time</th>
                  <th className="px-4 py-3 text-left font-medium">Actor</th>
                  <th className="px-4 py-3 text-left font-medium">Action</th>
                  <th className="px-4 py-3 text-left font-medium">Entity</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-3 text-gray-600">{log.actor || '-'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${actionColors[log.action] ?? 'bg-gray-100 text-gray-600'}`}>{log.action}</span></td>
                    <td className="px-4 py-3 text-gray-600">{log.entity}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-xs">{JSON.stringify(log.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
