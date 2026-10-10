import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Truck,
  Users,
  Undo2,
  Receipt,
  Wallet,
  BarChart3,
  UserCog,
  Settings,
  ScrollText,
} from 'lucide-react';
import type { UserRole } from '@/types';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'cashier'] },
  { id: 'pos', label: 'POS / Billing', icon: ShoppingCart, roles: ['admin', 'manager', 'cashier'] },
  { id: 'products', label: 'Products', icon: Package, roles: ['admin', 'manager'] },
  { id: 'inventory', label: 'Inventory', icon: Boxes, roles: ['admin', 'manager'] },
  { id: 'purchases', label: 'Purchases', icon: Truck, roles: ['admin', 'manager'] },
  { id: 'customers', label: 'Customers', icon: Users, roles: ['admin', 'manager', 'cashier'] },
  { id: 'suppliers', label: 'Suppliers', icon: Truck, roles: ['admin', 'manager'] },
  { id: 'returns', label: 'Returns', icon: Undo2, roles: ['admin', 'manager'] },
  { id: 'expenses', label: 'Expenses', icon: Receipt, roles: ['admin', 'manager'] },
  { id: 'payments', label: 'Payments', icon: Wallet, roles: ['admin', 'manager', 'cashier'] },
  { id: 'reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'manager'] },
  { id: 'users', label: 'Users & Roles', icon: UserCog, roles: ['admin'] },
  { id: 'settings', label: 'Settings', icon: Settings, roles: ['admin'] },
  { id: 'audit', label: 'Audit Logs', icon: ScrollText, roles: ['admin'] },
];

export function getNavItemsForRole(role: UserRole | null): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
