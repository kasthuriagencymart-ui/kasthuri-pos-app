import { useState, type ReactNode } from 'react';
import { Menu, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getNavItemsForRole } from '@/config/navigation';
import { useToast } from '@/components/ui/Toast';

interface LayoutProps {
  activeView: string;
  onNavigate: (view: string) => void;
  children: ReactNode;
}

export function Layout({ activeView, onNavigate, children }: LayoutProps) {
  const { appUser, signOut } = useAuth();
  const { showToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = getNavItemsForRole(appUser?.role ?? 'cashier');
  const activeItem = navItems.find((item) => item.id === activeView);

  const handleSignOut = async () => {
    await signOut();
    showToast('Signed out successfully', 'info');
  };

  const handleNav = (view: string) => {
    onNavigate(view);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-slate-900 text-slate-300 flex-col z-40 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } flex`}
      >
        <div className="px-5 py-5 border-b border-slate-700/50 flex items-center gap-2.5">
          <img src="/ChatGPT_Image_Aug_28,_2026,_08_48_25_AM.png" alt="Kasthuri Agency & Mart" className="w-10 h-10 rounded-xl object-cover bg-white" />
          <div className="min-w-0">
            <h1 className="text-white font-bold text-sm leading-tight truncate">Kasthuri Agency & Mart</h1>
            <p className="text-slate-400 text-xs">Management System</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-700/50">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-sm">
              {appUser?.full_name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{appUser?.full_name ?? 'User'}</p>
              <p className="text-slate-400 text-xs capitalize">{appUser?.role ?? 'user'}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-600/20 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
            <Menu className="w-6 h-6 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <img src="/ChatGPT_Image_Aug_28,_2026,_08_48_25_AM.png" alt="Kasthuri Agency & Mart" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-bold text-gray-900 truncate">{activeItem?.label ?? 'Kasthuri Agency & Mart'}</span>
          </div>
          <div className="w-10" />
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 py-4 items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{activeItem?.label ?? 'Dashboard'}</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Welcome back,</span>
            <span className="text-sm font-semibold text-gray-900">{appUser?.full_name ?? 'User'}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">{children}</main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 flex items-center justify-around px-1 py-1.5 shadow-lg overflow-x-auto no-scrollbar">
        {navItems.slice(0, 6).map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors min-w-0 flex-1 ${
                active ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium truncate">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
