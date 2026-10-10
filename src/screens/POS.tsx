import { useEffect, useState, useRef, useCallback } from 'react';
import { Search, ScanLine, Plus, Minus, Trash2, ShoppingCart, X, CreditCard, Banknote, Smartphone, Wallet, Printer, Receipt, User, Camera, History, Ban, Usb, Bluetooth } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PrinterModal } from '@/components/ui/PrinterModal';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { generateThermalReceipt, generateA4Invoice } from '@/lib/thermalPrinter';
import { printHTML } from '@/lib/utils';
import { printerManager } from '@/lib/printer';
import type { Product, Customer, CartItem, ShopSettings, Sale, SaleItem } from '@/types';

export function POS() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [discount, setDiscount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [lastSaleItems, setLastSaleItems] = useState<SaleItem[]>([]);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [billHistory, setBillHistory] = useState<Sale[]>([]);
  const [historyItems, setHistoryItems] = useState<Record<string, SaleItem[]>>({});
  const [cancelSaleId, setCancelSaleId] = useState<string | null>(null);
  const [unknownBarcode, setUnknownBarcode] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [showPrinter, setShowPrinter] = useState(false);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const barcodeBuffer = useRef('');
  const printerSubRef = useRef<(() => void) | null>(null);
  const cartHydratedRef = useRef(false);
  const barcodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadData();
    loadSavedCart();
    printerSubRef.current = printerManager.subscribe((s) => setPrinterConnected(s.status === 'connected'));
    return () => { printerSubRef.current?.(); };
  }, []);

  useEffect(() => {
    if (!cartHydratedRef.current) return;
    const saveCart = async () => {
      const { error } = await supabase.from('pos_carts').upsert(
        { items: cart, discount, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
      if (error) showToast('Could not save the current cart', 'error');
    };
    void saveCart();
  }, [cart, discount]);

  const loadSavedCart = async () => {
    const { data, error } = await supabase
      .from('pos_carts')
      .select('items, discount')
      .maybeSingle();

    if (error) {
      showToast('Could not restore the current cart', 'error');
      cartHydratedRef.current = true;
      return;
    }

    if (data && Array.isArray(data.items)) {
      const restoredItems = data.items.filter(isCartItem);
      setCart(restoredItems);
      setDiscount(Number(data.discount) || 0);
    }
    cartHydratedRef.current = true;
  };

  const loadData = async () => {
    const [prodRes, custRes, setRes] = await Promise.all([
      supabase.from('products').select('*, category:categories(*)').eq('is_active', true).order('name'),
      supabase.from('customers').select('*').order('name'),
      supabase.from('shop_settings').select('*').maybeSingle(),
    ]);
    setProducts(prodRes.data as Product[] ?? []);
    setCustomers(custRes.data as Customer[] ?? []);
    setSettings(setRes.data as ShopSettings | null);
  };

  // Hardware barcode scanner detection
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.target !== searchRef.current) return;
      }
      if (e.key === 'Enter' && barcodeBuffer.current.length >= 4) {
        const code = barcodeBuffer.current;
        barcodeBuffer.current = '';
        handleBarcodeScan(code);
        return;
      }
      if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
        if (barcodeTimer.current) clearTimeout(barcodeTimer.current);
        barcodeTimer.current = setTimeout(() => { barcodeBuffer.current = ''; }, 100);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [products]);

  const handleBarcodeScan = useCallback((code: string) => {
    const product = products.find((p) => p.barcode === code || p.sku === code);
    if (product) {
      addToCart(product);
      showToast(`Added: ${product.name}`, 'success');
    } else {
      setUnknownBarcode(code);
      setNewProductName('');
      setNewProductPrice('');
      showToast(`No product found for barcode: ${code}. Create one?`, 'info');
    }
  }, [products]);

  const createProductFromBarcode = async () => {
    if (!newProductName.trim()) { showToast('Enter a product name', 'error'); return; }
    const price = parseFloat(newProductPrice) || 0;
    const { data, error } = await supabase.from('products').insert({
      name: newProductName,
      barcode: unknownBarcode,
      selling_price: price,
      purchase_price: price,
      mrp: price,
      is_active: true,
    }).select('*').single();
    if (error) { showToast(error.message, 'error'); return; }
    const newProduct = data as Product;
    addToCart(newProduct);
    showToast(`Created and added: ${newProduct.name}`, 'success');
    setUnknownBarcode('');
    setNewProductName('');
    setNewProductPrice('');
    loadData();
  };

  const loadBillHistory = async () => {
    const { data } = await supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(30);
    const sales = data as Sale[] ?? [];
    setBillHistory(sales);
    const itemsMap: Record<string, SaleItem[]> = {};
    for (const sale of sales) {
      const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', sale.id);
      itemsMap[sale.id] = items as SaleItem[] ?? [];
    }
    setHistoryItems(itemsMap);
  };

  const openHistory = () => {
    setShowHistory(true);
    loadBillHistory();
  };

  const reprintBill = async (sale: Sale) => {
    const items = historyItems[sale.id] ?? [];
    if (!settings) return;
    const printerState = printerManager.getState();
    if (printerState.status === 'connected' && (printerState.connection === 'usb' || printerState.connection === 'bluetooth')) {
      const ok = await printerManager.printReceipt(sale, settings, items);
      if (!ok) printHTML(generateThermalReceipt(sale, settings, items));
    } else {
      printHTML(generateThermalReceipt(sale, settings, items));
    }
  };

  const reprintA4 = (sale: Sale) => {
    const items = historyItems[sale.id] ?? [];
    if (settings) {
      printHTML(generateA4Invoice(sale, settings, items));
    }
  };

  const handleCancelSale = async () => {
    if (!cancelSaleId) return;
    const sale = billHistory.find((s) => s.id === cancelSaleId);
    if (!sale) return;
    // Restock items
    const items = historyItems[sale.id] ?? [];
    for (const item of items) {
      if (item.product_id) {
        const { data: prod } = await supabase.from('products').select('stock').eq('id', item.product_id).maybeSingle();
        if (prod) {
          await supabase.from('products').update({ stock: (prod as { stock: number }).stock + item.quantity, updated_at: new Date().toISOString() }).eq('id', item.product_id);
        }
      }
    }
    // Reduce customer credit if it was a credit sale
    if (sale.customer_id && sale.balance > 0) {
      const { data: cust } = await supabase.from('customers').select('credit_balance').eq('id', sale.customer_id).maybeSingle();
      if (cust) {
        await supabase.from('customers').update({ credit_balance: Math.max(0, (cust as { credit_balance: number }).credit_balance - sale.balance) }).eq('id', sale.customer_id);
      }
    }
    // Delete sale and its items
    await supabase.from('sale_items').delete().eq('sale_id', cancelSaleId);
    await supabase.from('sales').delete().eq('id', cancelSaleId);
    showToast('Bill cancelled and stock restored', 'success');
    setCancelSaleId(null);
    loadBillHistory();
    loadData();
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product_id === product.id);
      if (existing) {
        return prev.map((c) =>
          c.product_id === product.id
            ? { ...c, quantity: c.quantity + 1, total: (c.price - c.discount) * (c.quantity + 1) + c.tax * (c.quantity + 1) }
            : c
        );
      }
      const tax = (product.selling_price * product.gst) / 100;
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        quantity: 1,
        price: product.selling_price,
        discount: 0,
        tax: tax,
        total: product.selling_price + tax,
      }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => prev.map((c) => {
      if (c.product_id !== productId) return c;
      const newQty = c.quantity + delta;
      if (newQty <= 0) return c;
      return { ...c, quantity: newQty, total: (c.price - c.discount) * newQty + c.tax * newQty };
    }));
  };

  const setQty = (productId: string, qty: number) => {
    setCart((prev) => prev.map((c) =>
      c.product_id === productId
        ? { ...c, quantity: Math.max(1, qty), total: (c.price - c.discount) * Math.max(1, qty) + c.tax * Math.max(1, qty) }
        : c
    ));
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((c) => c.product_id !== productId));
  };

  const subtotal = cart.reduce((s, c) => s + (c.price - c.discount) * c.quantity, 0);
  const taxTotal = cart.reduce((s, c) => s + c.tax * c.quantity, 0);
  const total = Math.max(0, subtotal + taxTotal - discount);

  const filteredProducts = products.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q);
  });

  const filteredCustomers = customers.filter((c) =>
    !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)
  );

  const handleCheckout = async () => {
    if (cart.length === 0) { showToast('Cart is empty', 'error'); return; }
    setProcessing(true);
    try {
      const itemsJson = cart.map((c) => ({
        product_id: c.product_id,
        product_name: c.product_name,
        sku: c.sku,
        quantity: c.quantity,
        price: c.price,
        discount: c.discount,
        tax: c.tax * c.quantity,
        total: c.total,
      }));

      const paid = paymentMethod === 'credit' ? 0 : (parseFloat(paidAmount) || total);
      const balance = paymentMethod === 'credit' ? total : Math.max(0, total - paid);

      const { data: saleId, error } = await supabase.rpc('process_checkout', {
        p_customer_id: selectedCustomer?.id ?? null,
        p_customer_name: selectedCustomer?.name ?? 'Walk-in Customer',
        p_subtotal: subtotal,
        p_discount: discount,
        p_tax: taxTotal,
        p_total: total,
        p_paid: paid,
        p_balance: balance,
        p_payment_method: paymentMethod,
        p_payment_details: {},
        p_cashier: appUser?.full_name ?? '',
        p_notes: '',
        p_items: itemsJson,
      });

      if (error) throw error;

      // Fetch the sale with items
      const [saleRes, itemsRes] = await Promise.all([
        supabase.from('sales').select('*').eq('id', saleId).maybeSingle(),
        supabase.from('sale_items').select('*').eq('sale_id', saleId),
      ]);

      setLastSale(saleRes.data as Sale);
      setLastSaleItems(itemsRes.data as SaleItem[] ?? []);
      setShowReceipt(true);
      setShowCheckout(false);

      // Reset
      setCart([]);
      setSelectedCustomer(null);
      setDiscount(0);
      setPaidAmount('');
      setPaymentMethod('cash');
      showToast('Bill generated successfully!', 'success');

      // Reload products for stock
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Checkout failed', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handlePrint = async (type: 'thermal' | 'a4') => {
    if (!lastSale || !settings) return;
    if (type === 'thermal') {
      const printerState = printerManager.getState();
      if (printerState.status === 'connected' && (printerState.connection === 'usb' || printerState.connection === 'bluetooth')) {
        const ok = await printerManager.printReceipt(lastSale, settings, lastSaleItems);
        if (!ok) {
          showToast('Printer error. Using browser print instead.', 'error');
          printHTML(generateThermalReceipt(lastSale, settings, lastSaleItems));
        }
      } else {
        printHTML(generateThermalReceipt(lastSale, settings, lastSaleItems));
      }
    } else {
      printHTML(generateA4Invoice(lastSale, settings, lastSaleItems));
    }
  };

  const currency = settings?.currency ?? '₹';

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[calc(100vh-4rem)] lg:min-h-[calc(100vh-5rem)]">
      {/* Product Search & List */}
      <div className="flex-1 flex flex-col p-4 lg:p-6 overflow-hidden">
        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU or barcode..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-gray-900"
              autoFocus
            />
          </div>
          <button
            onClick={() => setShowScanner(true)}
            className="px-4 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <ScanLine className="w-5 h-5" />
            <span className="hidden sm:inline">Scan</span>
          </button>
          <button
            onClick={openHistory}
            className="px-4 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <History className="w-5 h-5" />
            <span className="hidden sm:inline">Bills</span>
          </button>
          <button
            onClick={() => setShowPrinter(true)}
            className={`px-4 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
              printerConnected
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={printerConnected ? 'Printer connected' : 'Connect printer'}
          >
            {printerConnected ? <Bluetooth className="w-5 h-5" /> : <Usb className="w-5 h-5" />}
            <span className="hidden sm:inline">{printerConnected ? 'Printer' : 'Connect'}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <p className="text-center text-gray-400 py-12">No products found</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white rounded-xl border border-gray-100 p-3 text-left hover:border-blue-300 hover:shadow-md transition-all active:scale-95"
                >
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-20 rounded-lg object-cover mb-2" />
                  ) : (
                    <div className="w-full h-20 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center mb-2">
                      <span className="text-2xl font-bold text-blue-200">{product.name.charAt(0)}</span>
                    </div>
                  )}
                  <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                  <p className="text-xs text-gray-500">{product.unit} · Stock: {product.stock}</p>
                  <p className="text-base font-bold text-blue-600 mt-1">{formatCurrency(product.selling_price, currency)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Panel - Desktop */}
      <div className="hidden lg:flex lg:w-96 bg-white border-l border-gray-200 flex-col">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-gray-900">Cart ({cart.length})</h3>
            </div>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-red-500 font-medium hover:text-red-600">
                Clear all
              </button>
            )}
          </div>
          <button
            onClick={() => setShowCustomerModal(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors text-left"
          >
            <User className="w-4 h-4 text-gray-400" />
            <span className="text-sm flex-1 truncate">{selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'}</span>
            {selectedCustomer && <X className="w-4 h-4 text-gray-400" onClick={(e) => { e.stopPropagation(); setSelectedCustomer(null); }} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">Cart is empty. Scan or tap products to add.</p>
          ) : (
            cart.map((item) => (
              <div key={item.product_id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.product_name}</p>
                  <p className="text-xs text-gray-500">{formatCurrency(item.price, currency)} × {item.quantity}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.product_id, -1)} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => setQty(item.product_id, parseInt(e.target.value) || 1)}
                    className="w-10 text-center text-sm border-0 focus:ring-0 p-0 bg-transparent"
                  />
                  <button onClick={() => updateQty(item.product_id, 1)} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeItem(item.product_id)} className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100 ml-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-sm font-bold text-gray-900 w-16 text-right">{formatCurrency(item.total, currency)}</span>
              </div>
            ))
          )}
        </div>

        {/* Totals & Checkout */}
        <div className="p-4 border-t border-gray-100 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-medium text-gray-900">{formatCurrency(subtotal, currency)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Tax/GST</span>
            <span className="font-medium text-gray-900">{formatCurrency(taxTotal, currency)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Discount</span>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-20 text-right text-sm border border-gray-200 rounded-lg px-2 py-1 focus:border-blue-500 outline-none"
              placeholder="0"
            />
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-100">
            <span className="text-gray-900">Total</span>
            <span className="text-blue-600">{formatCurrency(total, currency)}</span>
          </div>
          <button
            onClick={() => setShowCheckout(true)}
            disabled={cart.length === 0}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all disabled:opacity-50 disabled:shadow-none"
          >
            Checkout
          </button>
        </div>
      </div>

      {/* Mobile Floating Cart Button */}
      {cart.length > 0 && (
        <button
          onClick={() => setShowMobileCart(true)}
          className="lg:hidden fixed bottom-20 right-4 z-30 flex items-center gap-2 px-4 py-3 rounded-full bg-blue-600 text-white font-bold shadow-xl shadow-blue-500/40 active:scale-95 transition-transform"
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-sm">{cart.length}</span>
          <span className="text-sm">{formatCurrency(total, currency)}</span>
        </button>
      )}

      {/* Mobile Cart Modal */}
      <Modal open={showMobileCart} onClose={() => setShowMobileCart(false)} title={`Cart (${cart.length})`} size="full">
        <div className="flex flex-col max-h-[70vh]">
          <button
            onClick={() => { setShowMobileCart(false); setShowCustomerModal(true); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors text-left mb-3"
          >
            <User className="w-4 h-4 text-gray-400" />
            <span className="text-sm flex-1 truncate">{selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'}</span>
            {selectedCustomer && <X className="w-4 h-4 text-gray-400" onClick={(e) => { e.stopPropagation(); setSelectedCustomer(null); }} />}
          </button>

          <div className="flex-1 overflow-y-auto p-1 space-y-2 mb-3">
            {cart.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">Cart is empty</p>
            ) : (
              cart.map((item) => (
                <div key={item.product_id} className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.product_name}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(item.price, currency)} × {item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.product_id, -1)} className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center active:bg-gray-100">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <button onClick={() => updateQty(item.product_id, 1)} className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center active:bg-gray-100">
                      <Plus className="w-4 h-4" />
                    </button>
                    <button onClick={() => removeItem(item.product_id)} className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 active:bg-red-100 ml-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium text-gray-900">{formatCurrency(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Tax/GST</span>
              <span className="font-medium text-gray-900">{formatCurrency(taxTotal, currency)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Discount</span>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-20 text-right text-sm border border-gray-200 rounded-lg px-2 py-1 focus:border-blue-500 outline-none"
                placeholder="0"
              />
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-100">
              <span className="text-gray-900">Total</span>
              <span className="text-blue-600">{formatCurrency(total, currency)}</span>
            </div>
            <button
              onClick={() => { setShowMobileCart(false); setShowCheckout(true); }}
              disabled={cart.length === 0}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold shadow-lg disabled:opacity-50"
            >
              Checkout - {formatCurrency(total, currency)}
            </button>
          </div>
        </div>
      </Modal>

      {/* Customer Modal */}
      <Modal open={showCustomerModal} onClose={() => setShowCustomerModal(false)} title="Select Customer">
        <input
          type="text"
          value={customerSearch}
          onChange={(e) => setCustomerSearch(e.target.value)}
          placeholder="Search customer by name or phone..."
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none mb-4"
          autoFocus
        />
        <div className="space-y-1 max-h-64 overflow-y-auto">
          <button
            onClick={() => { setSelectedCustomer(null); setShowCustomerModal(false); }}
            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-600"
          >
            Walk-in Customer
          </button>
          {filteredCustomers.map((c) => (
            <button
              key={c.id}
              onClick={() => { setSelectedCustomer(c); setShowCustomerModal(false); }}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50"
            >
              <p className="font-medium text-gray-900">{c.name}</p>
              <p className="text-xs text-gray-500">{c.phone} {c.credit_balance > 0 && `· Credit: ${formatCurrency(c.credit_balance, currency)}`}</p>
            </button>
          ))}
        </div>
      </Modal>

      {/* Barcode Scanner Modal */}
      <Modal open={showScanner} onClose={() => setShowScanner(false)} title="Scan Barcode">
        <BarcodeScanner onScan={(code) => { handleBarcodeScan(code); setShowScanner(false); }} />
        <p className="text-sm text-gray-500 mt-4 text-center">Point your camera at a barcode (EAN, UPC, Code 128, QR)</p>
      </Modal>

      {/* Checkout Modal */}
      <Modal open={showCheckout} onClose={() => setShowCheckout(false)} title="Payment & Checkout">
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex justify-between mb-1"><span className="text-gray-500 text-sm">Total Amount</span><span className="font-bold text-lg text-blue-600">{formatCurrency(total, currency)}</span></div>
            {selectedCustomer && <div className="text-sm text-gray-500">Customer: {selectedCustomer.name}</div>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'cash', label: 'Cash', icon: Banknote },
                { id: 'upi', label: 'UPI', icon: Smartphone },
                { id: 'card', label: 'Card', icon: CreditCard },
                { id: 'credit', label: 'Credit', icon: Wallet },
                { id: 'split', label: 'Split', icon: Receipt },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${
                      paymentMethod === m.id ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {paymentMethod !== 'credit' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount Paid</label>
              <input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder={total.toFixed(2)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-lg font-semibold"
              />
              {paidAmount && parseFloat(paidAmount) > total && (
                <p className="text-sm text-green-600 mt-1">Change: {formatCurrency(parseFloat(paidAmount) - total, currency)}</p>
              )}
            </div>
          )}

          {paymentMethod === 'credit' && selectedCustomer && (
            <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-lg">
              Credit balance will be added to {selectedCustomer.name}'s account
            </p>
          )}

          <button
            onClick={handleCheckout}
            disabled={processing}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold shadow-lg disabled:opacity-60"
          >
            {processing ? 'Processing...' : `Complete Sale - ${formatCurrency(total, currency)}`}
          </button>
        </div>
      </Modal>

      {/* Unknown Barcode - Create Product Modal */}
      <Modal open={!!unknownBarcode} onClose={() => setUnknownBarcode('')} title={`New Product for Barcode: ${unknownBarcode}`} size="sm">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">No product matches this barcode. Create a new product with this barcode pre-filled?</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
            <input type="text" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="Product name..." className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price</label>
            <input type="number" value={newProductPrice} onChange={(e) => setNewProductPrice(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none" />
          </div>
          <button onClick={createProductFromBarcode} className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700">Create & Add to Cart</button>
        </div>
      </Modal>

      {/* Bill History Modal */}
      <Modal open={showHistory} onClose={() => setShowHistory(false)} title="Bill History (Last 30)" size="xl">
        {billHistory.length === 0 ? (
          <p className="text-gray-400 text-center py-6">No bills yet</p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {billHistory.map((sale) => (
              <div key={sale.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{sale.invoice_number}</p>
                  <p className="text-xs text-gray-500">{sale.customer_name} · {formatDateTime(sale.created_at)} · {sale.payment_method}</p>
                </div>
                <span className="font-bold text-gray-900 text-sm hidden sm:block">{formatCurrency(sale.total, currency)}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => reprintBill(sale)} title="Reprint thermal" className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"><Printer className="w-4 h-4" /></button>
                  <button onClick={() => reprintA4(sale)} title="Reprint A4" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><Receipt className="w-4 h-4" /></button>
                  <button onClick={() => setCancelSaleId(sale.id)} title="Cancel bill" className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Ban className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!cancelSaleId} onClose={() => setCancelSaleId(null)} onConfirm={handleCancelSale} title="Cancel Bill" message="This will cancel the bill, delete it, and restore stock to inventory. This cannot be undone." confirmLabel="Cancel Bill" danger />

      <PrinterModal open={showPrinter} onClose={() => setShowPrinter(false)} />

      {/* Receipt Modal */}
      <Modal open={showReceipt} onClose={() => setShowReceipt(false)} title="Bill Generated" size="sm">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <Receipt className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{lastSale?.invoice_number}</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(lastSale?.total ?? 0, currency)}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handlePrint('thermal')} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 flex items-center justify-center gap-2">
              <Printer className="w-4 h-4" /> Print Bill
            </button>
            <button onClick={() => handlePrint('a4')} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 flex items-center justify-center gap-2">
              <Receipt className="w-4 h-4" /> A4 Invoice
            </button>
          </div>
          <button onClick={() => setShowReceipt(false)} className="w-full py-2.5 rounded-xl text-gray-600 font-medium hover:bg-gray-100">
            New Sale
          </button>
        </div>
      </Modal>
    </div>
  );
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CartItem>;
  return typeof item.product_id === 'string'
    && typeof item.product_name === 'string'
    && typeof item.sku === 'string'
    && typeof item.quantity === 'number'
    && typeof item.price === 'number'
    && typeof item.discount === 'number'
    && typeof item.tax === 'number'
    && typeof item.total === 'number';
}

function BarcodeScanner({ onScan }: { onScan: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        // Simple barcode detection using BarcodeDetector API if available
        if ('BarcodeDetector' in window) {
          const detector = new (window as unknown as { BarcodeDetector: new (opts?: { formats?: string[] }) => { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'code_128', 'qr_code'] });
          interval = setInterval(async () => {
            if (!videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes.length > 0 && codes[0].rawValue) {
                onScan(codes[0].rawValue);
              }
            } catch { /* detection errors are expected */ }
          }, 500);
        } else {
          setError('Camera barcode detection not supported on this browser. Enter the code manually below.');
        }
      } catch {
        setError('Camera access denied. Enter the barcode manually below.');
      }
    };
    startCamera();

    return () => {
      if (interval) clearInterval(interval);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [onScan]);

  return (
    <div>
      {error ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3">
          <p className="text-sm text-amber-700">{error}</p>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video mb-3">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-1 bg-red-500/70 rounded-full" />
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="Enter barcode manually..."
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
          onKeyDown={(e) => { if (e.key === 'Enter' && manualCode) onScan(manualCode); }}
        />
        <button onClick={() => manualCode && onScan(manualCode)} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700">
          <Camera className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
