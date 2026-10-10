import { useEffect, useState } from 'react';
import { BarChart3, Download, TrendingUp, Package, Users, Truck, Receipt, Wallet, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatDate, todayISO, startOfMonthISO, downloadCSV } from '@/lib/utils';
import type { Sale, Product, Customer, Supplier, Expense, Purchase } from '@/types';

type ReportType = 'sales' | 'product_sales' | 'profit' | 'purchases' | 'inventory' | 'low_stock' | 'customer_outstanding' | 'supplier_outstanding' | 'payment_methods' | 'gst' | 'expenses';

export function Reports() {
  const { showToast } = useToast();
  const [reportType, setReportType] = useState<ReportType>('sales');
  const [fromDate, setFromDate] = useState(startOfMonthISO());
  const [toDate, setToDate] = useState(todayISO());
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => { loadReport(); }, [reportType, fromDate, toDate]);

  const loadReport = async () => {
    setLoading(true);
    setSummary([]);
    try {
      switch (reportType) {
        case 'sales': await loadSalesReport(); break;
        case 'product_sales': await loadProductSalesReport(); break;
        case 'profit': await loadProfitReport(); break;
        case 'purchases': await loadPurchasesReport(); break;
        case 'inventory': await loadInventoryReport(); break;
        case 'low_stock': await loadLowStockReport(); break;
        case 'customer_outstanding': await loadCustomerOutstandingReport(); break;
        case 'supplier_outstanding': await loadSupplierOutstandingReport(); break;
        case 'payment_methods': await loadPaymentMethodsReport(); break;
        case 'gst': await loadGSTReport(); break;
        case 'expenses': await loadExpensesReport(); break;
      }
    } catch {
      showToast('Failed to load report', 'error');
    }
    setLoading(false);
  };

  const loadSalesReport = async () => {
    const { data: sales } = await supabase.from('sales').select('*').gte('created_at', fromDate + 'T00:00:00').lte('created_at', toDate + 'T23:59:59').order('created_at', { ascending: false });
    const rows = (sales as Sale[] ?? []).map((s) => ({ 'Invoice': s.invoice_number, 'Date': formatDate(s.created_at), 'Customer': s.customer_name, 'Subtotal': s.subtotal, 'Discount': s.discount, 'Tax': s.tax, 'Total': s.total, 'Payment': s.payment_method, 'Cashier': s.cashier }));
    setData(rows);
    const total = (sales as Sale[] ?? []).reduce((s, r) => s + r.total, 0);
    setSummary([{ label: 'Total Sales', value: formatCurrency(total) }, { label: 'Number of Bills', value: String(sales?.length ?? 0) }]);
  };

  const loadProductSalesReport = async () => {
    const { data: items } = await supabase.from('sale_items').select('product_name, quantity, price, total, sale:sales!inner(created_at)').gte('sale.created_at', fromDate + 'T00:00:00').lte('sale.created_at', toDate + 'T23:59:59');
    const grouped = new Map<string, { name: string; qty: number; revenue: number }>();
    (items as unknown as { product_name: string; quantity: number; total: number }[] ?? []).forEach((i) => {
      const existing = grouped.get(i.product_name) ?? { name: i.product_name, qty: 0, revenue: 0 };
      existing.qty += Number(i.quantity);
      existing.revenue += Number(i.total);
      grouped.set(i.product_name, existing);
    });
    const rows = Array.from(grouped.values()).sort((a, b) => b.revenue - a.revenue).map((g) => ({ 'Product': g.name, 'Quantity Sold': g.qty, 'Revenue': g.revenue }));
    setData(rows);
    setSummary([{ label: 'Total Products', value: String(rows.length) }, { label: 'Total Revenue', value: formatCurrency(rows.reduce((s, r) => s + r.Revenue, 0)) }]);
  };

  const loadProfitReport = async () => {
    const { data: items } = await supabase.from('sale_items').select('product_id, product_name, quantity, total, sale:sales!inner(created_at)').gte('sale.created_at', fromDate + 'T00:00:00').lte('sale.created_at', toDate + 'T23:59:59');
    const productIds = [...new Set((items as unknown as { product_id: string }[] ?? []).map((i) => i.product_id).filter(Boolean))] as string[];
    const { data: products } = await supabase.from('products').select('id, purchase_price').in('id', productIds);
    const prodMap = new Map((products as { id: string; purchase_price: number }[] ?? []).map((p) => [p.id, p.purchase_price]));
    const grouped = new Map<string, { name: string; qty: number; revenue: number; cost: number }>();
    (items as unknown as { product_id: string; product_name: string; quantity: number; total: number }[] ?? []).forEach((i) => {
      const existing = grouped.get(i.product_name) ?? { name: i.product_name, qty: 0, revenue: 0, cost: 0 };
      existing.qty += Number(i.quantity);
      existing.revenue += Number(i.total);
      existing.cost += Number(i.quantity) * (prodMap.get(i.product_id) ?? 0);
      grouped.set(i.product_name, existing);
    });
    const rows = Array.from(grouped.values()).map((g) => ({ 'Product': g.name, 'Quantity': g.qty, 'Revenue': g.revenue, 'Cost': g.cost, 'Profit': g.revenue - g.cost }));
    rows.sort((a, b) => b.Profit - a.Profit);
    setData(rows);
    const totalProfit = rows.reduce((s, r) => s + r.Profit, 0);
    setSummary([{ label: 'Total Profit', value: formatCurrency(totalProfit) }, { label: 'Total Revenue', value: formatCurrency(rows.reduce((s, r) => s + r.Revenue, 0)) }]);
  };

  const loadPurchasesReport = async () => {
    const { data: purchases } = await supabase.from('purchases').select('*').gte('created_at', fromDate + 'T00:00:00').lte('created_at', toDate + 'T23:59:59').order('created_at', { ascending: false });
    const rows = (purchases as Purchase[] ?? []).map((p) => ({ 'Invoice': p.invoice_number, 'Date': formatDate(p.created_at), 'Supplier': p.supplier_name, 'Total': p.total, 'Paid': p.paid, 'Balance': p.balance }));
    setData(rows);
    setSummary([{ label: 'Total Purchases', value: formatCurrency((purchases as Purchase[] ?? []).reduce((s, p) => s + p.total, 0)) }, { label: 'Number of Purchases', value: String(purchases?.length ?? 0) }]);
  };

  const loadInventoryReport = async () => {
    const { data: products } = await supabase.from('products').select('*, category:categories(*)').order('name');
    const rows = (products as Product[] ?? []).map((p) => ({ 'Product': p.name, 'SKU': p.sku, 'Category': p.category?.name ?? '', 'Stock': p.stock, 'Unit': p.unit, 'Purchase Price': p.purchase_price, 'Stock Value': p.stock * p.purchase_price, 'Selling Price': p.selling_price }));
    setData(rows);
    const totalValue = (products as Product[] ?? []).reduce((s, p) => s + p.stock * p.purchase_price, 0);
    setSummary([{ label: 'Total Stock Value', value: formatCurrency(totalValue) }, { label: 'Total Products', value: String(products?.length ?? 0) }]);
  };

  const loadLowStockReport = async () => {
    const { data: products } = await supabase.from('products').select('*, category:categories(*)').order('name');
    const lowStock = (products as Product[] ?? []).filter((p) => p.stock <= p.min_stock);
    const rows = lowStock.map((p) => ({ 'Product': p.name, 'SKU': p.sku, 'Current Stock': p.stock, 'Min Stock': p.min_stock, 'Unit': p.unit, 'Category': p.category?.name ?? '' }));
    setData(rows);
    setSummary([{ label: 'Low Stock Items', value: String(lowStock.length) }]);
  };

  const loadCustomerOutstandingReport = async () => {
    const { data: customers } = await supabase.from('customers').select('*').order('name');
    const withCredit = (customers as Customer[] ?? []).filter((c) => c.credit_balance > 0);
    const rows = withCredit.map((c) => ({ 'Customer': c.name, 'Phone': c.phone, 'Credit Balance': c.credit_balance, 'Email': c.email }));
    setData(rows);
    setSummary([{ label: 'Total Outstanding', value: formatCurrency(withCredit.reduce((s, c) => s + c.credit_balance, 0)) }, { label: 'Customers with Credit', value: String(withCredit.length) }]);
  };

  const loadSupplierOutstandingReport = async () => {
    const { data: suppliers } = await supabase.from('suppliers').select('*').order('name');
    const withOutstanding = (suppliers as Supplier[] ?? []).filter((s) => s.outstanding > 0);
    const rows = withOutstanding.map((s) => ({ 'Supplier': s.name, 'Phone': s.phone, 'Outstanding': s.outstanding, 'Email': s.email }));
    setData(rows);
    setSummary([{ label: 'Total Outstanding', value: formatCurrency(withOutstanding.reduce((s, sup) => s + sup.outstanding, 0)) }, { label: 'Suppliers with Dues', value: String(withOutstanding.length) }]);
  };

  const loadPaymentMethodsReport = async () => {
    const { data: sales } = await supabase.from('sales').select('payment_method, total').gte('created_at', fromDate + 'T00:00:00').lte('created_at', toDate + 'T23:59:59');
    const grouped = new Map<string, number>();
    (sales as { payment_method: string; total: number }[] ?? []).forEach((s) => {
      grouped.set(s.payment_method, (grouped.get(s.payment_method) ?? 0) + Number(s.total));
    });
    const rows = Array.from(grouped.entries()).map(([method, total]) => ({ 'Payment Method': method, 'Total Amount': total, 'Count': (sales as { payment_method: string }[] ?? []).filter((s) => s.payment_method === method).length }));
    setData(rows);
    setSummary([{ label: 'Total Collected', value: formatCurrency(Array.from(grouped.values()).reduce((s, v) => s + v, 0)) }]);
  };

  const loadGSTReport = async () => {
    const { data: sales } = await supabase.from('sales').select('invoice_number, subtotal, tax, total, created_at').gte('created_at', fromDate + 'T00:00:00').lte('created_at', toDate + 'T23:59:59').order('created_at', { ascending: false });
    const rows = (sales as Sale[] ?? []).map((s) => ({ 'Invoice': s.invoice_number, 'Date': formatDate(s.created_at), 'Taxable Amount': s.subtotal, 'GST Collected': s.tax, 'Total': s.total }));
    setData(rows);
    setSummary([{ label: 'Total GST Collected', value: formatCurrency((sales as Sale[] ?? []).reduce((s, r) => s + r.tax, 0)) }]);
  };

  const loadExpensesReport = async () => {
    const { data: expenses } = await supabase.from('expenses').select('*').gte('created_at', fromDate + 'T00:00:00').lte('created_at', toDate + 'T23:59:59').order('created_at', { ascending: false });
    const rows = (expenses as Expense[] ?? []).map((e) => ({ 'Category': e.category, 'Description': e.description, 'Amount': e.amount, 'Method': e.payment_method, 'Date': formatDate(e.created_at) }));
    setData(rows);
    setSummary([{ label: 'Total Expenses', value: formatCurrency((expenses as Expense[] ?? []).reduce((s, e) => s + e.amount, 0)) }]);
  };

  const handleExport = () => {
    if (data.length === 0) { showToast('No data to export', 'error'); return; }
    const headers = Object.keys(data[0]);
    const rows = data.map((r) => headers.map((h) => r[h] as string | number));
    downloadCSV(`${reportType}_report_${todayISO()}.csv`, headers, rows);
    showToast('Report exported as CSV', 'success');
  };

  const reportOptions: { id: ReportType; label: string; icon: typeof BarChart3 }[] = [
    { id: 'sales', label: 'Sales Report', icon: TrendingUp },
    { id: 'product_sales', label: 'Product-wise Sales', icon: Package },
    { id: 'profit', label: 'Profit Report', icon: TrendingUp },
    { id: 'purchases', label: 'Purchases Report', icon: Truck },
    { id: 'inventory', label: 'Inventory Valuation', icon: Package },
    { id: 'low_stock', label: 'Low Stock', icon: Package },
    { id: 'customer_outstanding', label: 'Customer Outstanding', icon: Users },
    { id: 'supplier_outstanding', label: 'Supplier Outstanding', icon: Truck },
    { id: 'payment_methods', label: 'Payment Methods', icon: Wallet },
    { id: 'gst', label: 'GST Report', icon: FileText },
    { id: 'expenses', label: 'Expenses Report', icon: Receipt },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {reportOptions.map((opt) => {
          const Icon = opt.icon;
          return (
            <button key={opt.id} onClick={() => setReportType(opt.id)} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${reportType === opt.id ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'}`}>
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium text-center">{opt.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" />
        </div>
        <button onClick={handleExport} disabled={data.length === 0} className="px-4 py-2 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 flex items-center gap-2 disabled:opacity-50">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {summary.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {summary.map((s) => (
            <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-lg font-bold text-gray-900">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading report...</p>
      ) : data.length === 0 ? (
        <div className="text-center py-12"><BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-400">No data for this report in the selected period</p></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>{Object.keys(data[0]).map((h) => <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {Object.values(row).map((v, j) => {
                      const isCurrency = ['Total', 'Revenue', 'Cost', 'Profit', 'Amount', 'Subtotal', 'Discount', 'Tax', 'Paid', 'Balance', 'Stock Value', 'Purchase Price', 'Selling Price', 'Credit Balance', 'Outstanding', 'Total Amount', 'GST Collected', 'Taxable Amount'].includes(Object.keys(row)[j]);
                      return <td key={j} className={`px-4 py-3 ${isCurrency ? 'text-right font-medium' : ''}`}>{isCurrency ? formatCurrency(Number(v) || 0) : String(v)}</td>;
                    })}
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
