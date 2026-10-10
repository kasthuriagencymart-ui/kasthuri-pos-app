import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import { Layout } from '@/components/Layout';
import { SignIn } from '@/screens/SignIn';
import { SignUp } from '@/screens/SignUp';
import { Dashboard } from '@/screens/Dashboard';
import { POS } from '@/screens/POS';
import { Products } from '@/screens/Products';
import { Inventory } from '@/screens/Inventory';
import { Purchases } from '@/screens/Purchases';
import { Customers } from '@/screens/Customers';
import { Suppliers } from '@/screens/Suppliers';
import { Returns } from '@/screens/Returns';
import { Expenses } from '@/screens/Expenses';
import { Payments } from '@/screens/Payments';
import { Reports } from '@/screens/Reports';
import { Users } from '@/screens/Users';
import { Settings } from '@/screens/Settings';
import { AuditLogs } from '@/screens/AuditLogs';
import { getNavItemsForRole } from '@/config/navigation';

function AppContent() {
  const { session, appUser, loading } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const [pathname, setPathname] = useState(window.location.pathname);
  const navItems = getNavItemsForRole(appUser?.role ?? 'cashier');

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Reset to dashboard when user changes
  useEffect(() => {
    if (session && appUser) setActiveView('dashboard');
  }, [session, appUser]);

  useEffect(() => {
    if (!navItems.some((item) => item.id === activeView)) {
      setActiveView('dashboard');
    }
  }, [activeView, navItems]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading Kasthuri Agency & Mart...</p>
        </div>
      </div>
    );
  }

  if (!session || !appUser) {
    if (pathname === '/signup') return <SignUp />;
    return <SignIn />;
  }


  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard />;
      case 'pos': return <POS />;
      case 'products': return <Products />;
      case 'inventory': return <Inventory />;
      case 'purchases': return <Purchases />;
      case 'customers': return <Customers />;
      case 'suppliers': return <Suppliers />;
      case 'returns': return <Returns />;
      case 'expenses': return <Expenses />;
      case 'payments': return <Payments />;
      case 'reports': return <Reports />;
      case 'users': return <Users />;
      case 'settings': return <Settings />;
      case 'audit': return <AuditLogs />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout activeView={activeView} onNavigate={setActiveView}>
      {renderView()}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
