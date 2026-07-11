import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, ListTree, Grid3X3, Table2,
  Users, UserCog, TicketPercent, Gift, ClipboardList,
  ChefHat, Settings, LogOut, Receipt, ShoppingCart, BarChart3, QrCode
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const adminOnlyPaths = ['/reports', '/categories', '/products', '/floors', '/tables', '/employees', '/coupons', '/promotions', '/settings', '/self-order'];

const allNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pos', label: 'POS', icon: ShoppingCart },
  { to: '/categories', label: 'Categories', icon: ListTree },
  { to: '/products', label: 'Products', icon: ShoppingBag },
  { to: '/floors', label: 'Floors', icon: Grid3X3 },
  { to: '/tables', label: 'Tables', icon: Table2 },
  { to: '/orders', label: 'Orders', icon: Receipt },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/employees', label: 'Employees', icon: UserCog },
  { to: '/coupons', label: 'Coupons', icon: TicketPercent },
  { to: '/promotions', label: 'Promotions', icon: Gift },
  { to: '/sessions', label: 'Sessions', icon: ClipboardList },
  { to: '/kds', label: 'KDS Tickets', icon: ChefHat },
  { to: '/self-order', label: 'Self Order', icon: QrCode },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const isCashier = user?.role === 'cashier';

  const navItems = allNavItems.filter((item) => {
    if (isCashier && adminOnlyPaths.includes(item.to)) return false;
    if (!isCashier && item.to === '/pos') return false;
    return true;
  });

  return (
    <aside className={`bg-bg-app border-r border-border flex flex-col transition-all duration-200 ${collapsed ? 'w-16' : 'w-56'}`}>
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
        <img src="/odoo_cafe_logo.png" alt="Kaapi Cafe" className="h-8 w-8 rounded-full object-cover" />
        {!collapsed && <span className="text-body-strong text-text-primary">Kaapi POS</span>}
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard' || item.to === '/pos'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-body transition-colors ${
                isActive
                  ? 'text-text-primary border-l-[3px] border-accent bg-accent-soft/20'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-subtle border-l-[3px] border-transparent'
              }`
            }
          >
            <item.icon size={20} className="shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-4">
        {!collapsed && (
          <div className="text-caption text-text-secondary mb-2">
            {user?.name} <span className="text-text-disabled">({user?.role})</span>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-3 text-text-secondary hover:text-danger transition-colors text-body w-full"
        >
          <LogOut size={20} />
          {!collapsed && <span>Log out</span>}
        </button>
      </div>
    </aside>
  );
}
