import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, AlertTriangle, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, todayISO, startOfMonthISO } from '@/lib/utils';

interface DashboardData {
  todaySales: number;
  todayCount: number;
  monthSales: number;
  monthCount: number;
  totalProducts: number;
  lowStockCount: number;
  totalStockValue: number;
  totalCredit: number;
  totalOutstanding: number;
  monthExpenses: number;
  recentSales: { id: string; invoice_number: string; total: number; customer_name: string; created_at: string; payment_method: string }[];
  lowStockProducts: { id: string; name: string; stock: number; min_stock: number }[];
  dailySales: { date: string; total: number }[];
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    const today = todayISO();
    const monthStart = startOfMonthISO();

    const [todaySalesRes, monthSalesRes, productsRes, lowStockRes, stockValRes, creditRes, outstandingRes, expensesRes, recentSalesRes, dailySalesRes] = await Promise.all([
      supabase.from('sales').select('total').gte('created_at', today + 'T00:00:00').lte('created_at', today + 'T23:59:59'),
      supabase.from('sales').select('total').gte('created_at', monthStart + 'T00:00:00'),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id,name,stock,min_stock').filter('stock', 'lte', '0').limit(5),
      supabase.from('products').select('stock,purchase_price'),
      supabase.from('customers').select('credit_balance'),
      supabase.from('suppliers').select('outstanding'),
      supabase.from('expenses').select('amount').gte('created_at', monthStart + 'T00:00:00'),
      supabase.from('sales').select('id,invoice_number,total,customer_name,created_at,payment_method').order('created_at', { ascending: false }).limit(8),
      supabase.from('sales').select('total,created_at').gte('created_at', monthStart + 'T00:00:00').order('created_at', { ascending: true }),
    ]);

    const todaySales = (todaySalesRes.data ?? []).reduce((s, r) => s + Number(r.total), 0);
    const monthSales = (monthSalesRes.data ?? []).reduce((s, r) => s + Number(r.total), 0);
    const stockValue = (stockValRes.data ?? []).reduce((s, r) => s + Number(r.stock) * Number(r.purchase_price), 0);
    const totalCredit = (creditRes.data ?? []).reduce((s, r) => s + Number(r.credit_balance), 0);
    const totalOutstanding = (outstandingRes.data ?? []).reduce((s, r) => s + Number(r.outstanding), 0);
    const monthExpenses = (expensesRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);

    // Build daily sales chart
    const dailyMap = new Map<string, number>();
    (dailySalesRes.data ?? []).forEach((r) => {
      const date = r.created_at.slice(0, 10);
      dailyMap.set(date, (dailyMap.get(date) ?? 0) + Number(r.total));
    });
    const dailySales: { date: string; total: number }[] = [];
    const d = new Date(monthStart);
    while (d <= new Date()) {
      const ds = d.toISOString().slice(0, 10);
      dailySales.push({ date: ds, total: dailyMap.get(ds) ?? 0 });
      d.setDate(d.getDate() + 1);
    }

    // Get actual low stock
    const allProducts = lowStockRes.data ?? [];
    const lowStockProducts = allProducts.filter((p) => Number(p.stock) <= Number(p.min_stock));

    setData({
      todaySales,
      todayCount: todaySalesRes.data?.length ?? 0,
      monthSales,
      monthCount: monthSalesRes.data?.length ?? 0,
      totalProducts: productsRes.count ?? 0,
      lowStockCount: lowStockProducts.length,
      totalStockValue: stockValue,
      totalCredit,
      totalOutstanding,
      monthExpenses,
      recentSales: recentSalesRes.data ?? [],
      lowStockProducts,
      dailySales,
    });
    setLoading(false);
  };

  if (loading) return <div className="p-6 text-gray-500">Loading dashboard...</div>;
  if (!data) return null;

  const maxDaily = Math.max(...data.dailySales.map((d) => d.total), 1);

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
        <KPICard label="Today's Sales" value={formatCurrency(data.todaySales)} sub={`${data.todayCount} bills`} icon={DollarSign} color="blue" trend="up" />
        <KPICard label="Month Sales" value={formatCurrency(data.monthSales)} sub={`${data.monthCount} bills`} icon={TrendingUp} color="green" trend="up" />
        <KPICard label="Stock Value" value={formatCurrency(data.totalStockValue)} sub={`${data.totalProducts} products`} icon={Package} color="cyan" />
        <KPICard label="Expenses (Month)" value={formatCurrency(data.monthExpenses)} sub="This month" icon={TrendingDown} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Monthly Sales Trend</h3>
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex items-end gap-1 h-48">
            {data.dailySales.slice(-30).map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center group relative">
                <div
                  className="w-full rounded-t bg-gradient-to-t from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 transition-all cursor-pointer"
                  style={{ height: `${(d.total / maxDaily) * 100}%`, minHeight: d.total > 0 ? '4px' : '0px' }}
                />
                <div className="absolute -top-8 hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                  {formatDate(d.date)}: {formatCurrency(d.total)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Outstanding */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h3 className="font-bold text-gray-900">Financial Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-600">Customer Credit</span>
              </div>
              <span className="font-bold text-blue-700">{formatCurrency(data.totalCredit)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-xl">
              <div className="flex items-center gap-2">
                <ArrowDownRight className="w-5 h-5 text-orange-600" />
                <span className="text-sm text-gray-600">Supplier Outstanding</span>
              </div>
              <span className="font-bold text-orange-700">{formatCurrency(data.totalOutstanding)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-600">Net Profit (est)</span>
              </div>
              <span className="font-bold text-green-700">{formatCurrency(data.monthSales - data.monthExpenses)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Sales */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4">Recent Sales</h3>
          {data.recentSales.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No sales yet</p>
          ) : (
            <div className="space-y-2">
              {data.recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                      <ShoppingCart className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{sale.invoice_number}</p>
                      <p className="text-xs text-gray-500">{sale.customer_name} · {formatDate(sale.created_at)}</p>
                    </div>
                  </div>
                  <span className="font-semibold text-gray-900">{formatCurrency(sale.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-gray-900">Low Stock Alerts</h3>
          </div>
          {data.lowStockProducts.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">All products well stocked</p>
          ) : (
            <div className="space-y-2">
              {data.lowStockProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">Min: {p.min_stock}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${Number(p.stock) <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {p.stock} in stock
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, sub, icon: Icon, color, trend }: {
  label: string;
  value: string;
  sub: string;
  icon: typeof DollarSign;
  color: 'blue' | 'green' | 'cyan' | 'orange';
  trend?: 'up' | 'down';
}) {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    cyan: 'from-cyan-500 to-cyan-600',
    orange: 'from-orange-500 to-orange-600',
  };
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 lg:p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend && (
          <span className={`text-xs font-medium ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-lg lg:text-xl font-bold text-gray-900 mt-0.5">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}
