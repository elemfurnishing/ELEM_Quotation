import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';

import Dashboard from './pages/admin/Dashboard';
import Customer from './pages/admin/Customer';
import Quotations from './pages/admin/Quotations';
import CreateQuotation from './pages/admin/CreateQuotation';
import Settings from './pages/admin/Settings';

import AdminLayout from './layouts/AdminLayout';

// Helper to get first accessible page based on user's page access
const getFirstAccessiblePage = (user) => {
  if (!user) return '/login';

  // Page name to route mapping (includes common typo variations)
  const pageRoutes = {
    'Dashboard': '/admin/dashboard',
    'Dashborad': '/admin/dashboard', // Common typo
    'Customer': '/admin/customer',
    'Quotations': '/admin/quotations',
    'Settings': '/admin/settings'
  };

  // Check page access for ALL users (including Admin)
  const accessiblePages = user.pageAccess || [];

  // Go to first accessible page from their list
  if (accessiblePages.length > 0) {
    // Find the route for the first page (check exact match first, then trimmed)
    const firstPage = accessiblePages[0].trim();
    return pageRoutes[firstPage] || pageRoutes['Dashboard'];
  }

  // Default fallback
  return '/admin/dashboard';
};

function App() {
  const { user } = useAuth();

  return (
    <Routes>

      {/* LOGIN */}
      <Route
        path="/login"
        element={user ? <Navigate to={getFirstAccessiblePage(user)} /> : <Login />}
      />

      {/* ADMIN ROUTES */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to={getFirstAccessiblePage(user)} replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="customer" element={<Customer />} />
        <Route path="quotations" element={<Quotations />} />
        <Route path="create-quotation" element={<CreateQuotation />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* USER ROUTES */}
      <Route path="/user" element={<AdminLayout />}>
        <Route index element={<Navigate to={getFirstAccessiblePage(user)} replace />} />
        <Route path="dashboard" element={<Dashboard />} />
      </Route>

      {/* ROOT */}
      <Route
        path="/"
        element={
          user
            ? <Navigate to={getFirstAccessiblePage(user)} />
            : <Navigate to="/login" />
        }
      />
    </Routes>
  );
}

export default App;
