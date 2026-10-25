import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/DashboardTabs.css';

const TABS = [
  {
    role: 'donor',
    label: 'Donor',
    icon: '🍱',
    path: '/donor/dashboard',
    subtitle: 'Donate & Track Food',
  },
  {
    role: 'ngo',
    label: 'NGO',
    icon: '🏢',
    path: '/ngo/dashboard',
    subtitle: 'Claim & Distribute Food',
  },
  {
    role: 'volunteer',
    label: 'Volunteer',
    icon: '🚗',
    path: '/volunteer/dashboard',
    subtitle: 'Pickups & Deliveries',
  },
];

export default function DashboardTabs({ activeRole }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentRole = user?.role ? String(user.role).trim().toLowerCase() : '';

  const handleTabClick = (path) => {
    navigate(path);
  };

  return (
    <div className="dashboard-tabs-container" role="region" aria-label="Dashboard Role Selection">
      <div className="dashboard-tabs-header">
        <span className="dashboard-tabs-title">
          <span className="dashboard-tabs-title-dot" aria-hidden="true"></span>
          Role Dashboards
        </span>
        <span className="dashboard-tabs-role-indicator">
          Signed in as: <strong>{user?.name || 'User'}</strong> ({currentRole ? currentRole.toUpperCase() : 'Guest'})
        </span>
      </div>
      <div className="dashboard-tabs" role="tablist" aria-label="Role dashboards">
        {TABS.map((tab) => {
          const isActive = activeRole === tab.role;
          const isUserAssignedRole = currentRole === tab.role;
          const isAdmin = currentRole === 'admin';

          return (
            <button
              key={tab.role}
              id={`tab-${tab.role}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.role}`}
              className={`dashboard-tab${isActive ? ' dashboard-tab--active' : ''}${isUserAssignedRole ? ' dashboard-tab--assigned' : ''}`}
              onClick={() => handleTabClick(tab.path)}
              type="button"
            >
              <span className="dashboard-tab__icon" aria-hidden="true">{tab.icon}</span>
              <div className="dashboard-tab__text">
                <span className="dashboard-tab__label">{tab.label}</span>
                <span className="dashboard-tab__sub">{tab.subtitle}</span>
              </div>
              {isUserAssignedRole && (
                <span className="dashboard-tab__badge">My Role</span>
              )}
              {isAdmin && !isUserAssignedRole && (
                <span className="dashboard-tab__badge dashboard-tab__badge--admin">Admin</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
