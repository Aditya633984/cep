import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute
 *
 * Props:
 *   children  – the page to render when access is granted
 *   role      – optional; the single role allowed on this route
 *
 * Behaviour:
 *   - Not authenticated → redirect to /login
 *   - Authenticated but wrong role → redirect to the user's own dashboard
 */
const ROLE_DASHBOARD = {
  donor:     '/donor/dashboard',
  ngo:       '/ngo/dashboard',
  volunteer: '/volunteer/dashboard',
  admin:     '/admin/dashboard',
};

export default function ProtectedRoute({ children, role }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const userRole = user?.role ? String(user.role).trim().toLowerCase() : '';
  const requiredRole = role ? String(role).trim().toLowerCase() : '';

  if (requiredRole && userRole !== requiredRole) {
    const ownDash = ROLE_DASHBOARD[userRole] || '/';
    return <Navigate to={ownDash} replace />;
  }

  return children;
}
