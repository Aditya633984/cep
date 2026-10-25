import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/RoleAccessDenied.css';

const ROLE_INFO = {
  donor: {
    name: 'Donor',
    icon: '🍱',
    description: 'Post food donations, track donation status, and view community impact metrics.',
    dashPath: '/donor/dashboard',
  },
  ngo: {
    name: 'NGO',
    icon: '🏢',
    description: 'Browse available food donations, accept donations, manage receipts, and request volunteer transport.',
    dashPath: '/ngo/dashboard',
  },
  volunteer: {
    name: 'Volunteer',
    icon: '🚗',
    description: 'Claim food transport requests, perform pickups and deliveries between donors and NGOs, and log completions.',
    dashPath: '/volunteer/dashboard',
  },
};

export default function RoleAccessDenied({ requiredRole, userRole, user }) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const targetRole = ROLE_INFO[requiredRole] || {
    name: requiredRole ? requiredRole.toUpperCase() : 'Protected',
    icon: '🔒',
    description: 'This dashboard requires specific role-based permissions.',
    dashPath: '/',
  };

  const currentRole = ROLE_INFO[userRole] || {
    name: userRole ? userRole.toUpperCase() : 'Guest',
    icon: '👤',
    dashPath: '/',
  };

  const handleReturnHome = () => {
    navigate(currentRole.dashPath || '/', { replace: true });
  };

  const handleSwitchAccount = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="role-denied-wrapper">
      <div className="role-denied-card" role="alert">
        <div className="role-denied-icon-wrap">
          <span className="role-denied-icon" aria-hidden="true">🔒</span>
        </div>

        <h2 className="role-denied-title">
          {targetRole.name} Dashboard Access Restricted
        </h2>

        <p className="role-denied-subtitle">
          You are currently signed in as <strong>{user?.name || 'User'}</strong> with the role of{' '}
          <span className="role-denied-highlight">{currentRole.name}</span>.
        </p>

        <div className="role-denied-details">
          <div className="role-denied-details__item">
            <span className="role-denied-details__icon" aria-hidden="true">{targetRole.icon}</span>
            <div>
              <strong>Why is this restricted?</strong>
              <p>{targetRole.description}</p>
            </div>
          </div>
        </div>

        <div className="role-denied-actions">
          <button
            type="button"
            className="btn btn-primary role-denied-btn"
            onClick={handleReturnHome}
          >
            <span>{currentRole.icon}</span>
            Return to My {currentRole.name} Dashboard
          </button>

          <button
            type="button"
            className="btn btn-outline role-denied-btn"
            onClick={handleSwitchAccount}
          >
            <span>🚪</span>
            Sign In with Different Account
          </button>
        </div>
      </div>
    </div>
  );
}
