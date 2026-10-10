export type UserRole = 'admin' | 'manager' | 'cashier';

export interface AppUser {
  id: string;
  user_id: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export interface ShopSettings {
  id: string;
  user_id: string;
  shop_name: string;
  address: string;
  phone: string;
  gstin: string;
  logo_url: string;
  currency: string;
  thermal_width: number;
  footer_message: string;
  invoice_prefix: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface Product {
  id: string;
  user_id: string;
  name: string;
  sku: string;
  barcode: string;
  category_id: string | null;
  brand: string;
  unit: string;
  purchase_price: number;
  selling_price: number;
  mrp: number;
  gst: number;
  stock: number;
  min_stock: number;
  batch_number: string;
  expiry_date: string | null;
  image_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: Category;
}

export interface Customer {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  credit_balance: number;
  gstin: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  outstanding: number;
  created_at: string;
}

export interface Sale {
  id: string;
  user_id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
  payment_method: string;
  payment_details: Record<string, unknown>;
  status: string;
  cashier: string;
  notes: string;
  created_at: string;
  sale_items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  sku: string;
  quantity: number;
  price: number;
  discount: number;
  tax: number;
  total: number;
}

export interface Purchase {
  id: string;
  user_id: string;
  invoice_number: string;
  supplier_id: string | null;
  supplier_name: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
  payment_method: string;
  status: string;
  notes: string;
  created_at: string;
  purchase_items?: PurchaseItem[];
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface SalesReturn {
  id: string;
  user_id: string;
  return_number: string;
  sale_id: string | null;
  customer_id: string | null;
  customer_name: string;
  total: number;
  reason: string;
  status: string;
  created_at: string;
  sales_return_items?: SalesReturnItem[];
}

export interface SalesReturnItem {
  id: string;
  return_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface PurchaseReturn {
  id: string;
  user_id: string;
  return_number: string;
  purchase_id: string | null;
  supplier_id: string | null;
  supplier_name: string;
  total: number;
  reason: string;
  status: string;
  created_at: string;
  purchase_return_items?: PurchaseReturnItem[];
}

export interface PurchaseReturnItem {
  id: string;
  return_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Expense {
  id: string;
  user_id: string;
  category: string;
  description: string;
  amount: number;
  payment_method: string;
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  party_type: string;
  party_id: string | null;
  party_name: string;
  amount: number;
  payment_method: string;
  reference: string;
  notes: string;
  created_at: string;
}

export interface StockAdjustment {
  id: string;
  user_id: string;
  product_id: string;
  product_name: string;
  type: string;
  quantity_change: number;
  reason: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  actor: string;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface CartItem {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  price: number;
  discount: number;
  tax: number;
  total: number;
}
