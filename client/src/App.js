import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Categories from './pages/Categories';
import Products from './pages/Products';
import Floors from './pages/Floors';
import Tables from './pages/Tables';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import CreateOrder from './pages/CreateOrder';
import Customers from './pages/Customers';
import Employees from './pages/Employees';
import Coupons from './pages/Coupons';
import Promotions from './pages/Promotions';
import Sessions from './pages/Sessions';
import KDSTickets from './pages/KDSTickets';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import PosDashboard from './pages/PosDashboard';
import KitchenDisplay from './pages/KitchenDisplay';
import SelfOrderAdmin from './pages/SelfOrderAdmin';
import SelfOrderCustomer from './pages/SelfOrderCustomer';

function HomeRedirect() {
  const { user } = useAuth();
  if (user?.role === 'cashier') return <Navigate to="/pos" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/home" element={<ProtectedRoute><HomeRedirect /></ProtectedRoute>} />
          <Route path="/pos" element={<ProtectedRoute><PosDashboard /></ProtectedRoute>} />
          <Route path="/kitchen" element={<KitchenDisplay />} />
          <Route path="/s/:qrToken" element={<SelfOrderCustomer />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/products" element={<Products />} />
            <Route path="/floors" element={<Floors />} />
            <Route path="/tables" element={<Tables />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/new" element={<CreateOrder />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/coupons" element={<Coupons />} />
            <Route path="/promotions" element={<Promotions />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/kds" element={<KDSTickets />} />
            <Route path="/self-order" element={<SelfOrderAdmin />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
