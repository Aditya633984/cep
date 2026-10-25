import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardTabs from './DashboardTabs';
import RoleAccessDenied from './RoleAccessDenied';

/**
 * ProtectedRoute
 *
 * Props:
 *   children  – the page to render when access is granted
 *   role      – optional; the single role allowed on this route
 *
 * Behaviour:
 *   - Not authenticated → redirect to /login
 *   - Admin → permitted on all role dashboards
 *   - Authenticated with different role → displays DashboardTabs and clear RoleAccessDenied message
 */
export default function ProtectedRoute({ children, role }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const userRole = user?.role ? String(user.role).trim().toLowerCase() : '';
  const requiredRole = role ? String(role).trim().toLowerCase() : '';

  // Admins have access to all three dashboards according to existing permissions
  if (userRole === 'admin') {
    return children;
  }

  // If role is required and user does not have permission, show clear access-denied view with tabs
  if (requiredRole && userRole !== requiredRole) {
    return (
      <main className="dashboard-page">
        <DashboardTabs activeRole={requiredRole} />
        <RoleAccessDenied
          requiredRole={requiredRole}
          userRole={userRole}
          user={user}
        />
      </main>
    );
  }

  return children;
}
