import { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Navbar.css';

const ROLE_DASHBOARD = {
  donor:     '/donor/dashboard',
  ngo:       '/ngo/dashboard',
  volunteer: '/volunteer/dashboard',
  admin:     '/admin/dashboard',
};

const ROLE_LABELS = {
  donor:     'Donor',
  ngo:       'NGO',
  volunteer: 'Volunteer',
  admin:     'Admin',
};

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const closeMenu  = () => setMenuOpen(false);

  const handleLogout = async () => {
    closeMenu();
    await logout();
    navigate('/', { replace: true });
  };

  const dashPath = user ? (ROLE_DASHBOARD[user.role] || '/') : '/';

  const navLinks = [
    { to: '/',        label: 'Home'    },
    { to: '/about',   label: 'About'   },
    { to: '/contact', label: 'Contact' },
  ];

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="container navbar__inner">

        {/* Logo */}
        <Link to="/" className="navbar__logo" onClick={closeMenu} aria-label="FoodBridge Home">
          <div className="navbar__logo-icon" aria-hidden="true">🌉</div>
          <span className="navbar__logo-text">
            Food<span>Bridge</span>
          </span>
        </Link>

        {/* Desktop Links */}
        <ul className="navbar__links" role="list">
          {navLinks.map(({ to, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `navbar__link${isActive ? ' active' : ''}`
                }
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Desktop Auth Buttons */}
        <div className="navbar__actions">
          {isAuthenticated ? (
            <>
              <Link to={dashPath} className="navbar__user-info">
                <span className="navbar__user-avatar">
                  {user?.name?.charAt(0)?.toUpperCase() || '?'}
                </span>
                <span className="navbar__user-name">{user?.name}</span>
                <span className="navbar__user-role">{ROLE_LABELS[user?.role]}</span>
              </Link>
              <Link to={dashPath} className="btn btn-outline">
                Dashboard
              </Link>
              <button onClick={handleLogout} className="btn btn-primary">
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline">
                Log In
              </Link>
              <Link to="/register" className="btn btn-primary">
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Hamburger */}
        <button
          className="navbar__hamburger"
          onClick={toggleMenu}
          aria-expanded={menuOpen}
          aria-label="Toggle menu"
        >
          <span className="navbar__hamburger-line" />
          <span className="navbar__hamburger-line" />
          <span className="navbar__hamburger-line" />
        </button>
      </div>

      {/* Mobile Menu */}
      <div className={`navbar__mobile-menu${menuOpen ? ' open' : ''}`} role="menu">
        {navLinks.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `navbar__mobile-link${isActive ? ' active' : ''}`
            }
            onClick={closeMenu}
            role="menuitem"
          >
            {label}
          </NavLink>
        ))}

        <div className="navbar__mobile-divider" />

        <div className="navbar__mobile-actions">
          {isAuthenticated ? (
            <>
              <Link to={dashPath} className="btn btn-outline" onClick={closeMenu}>
                Dashboard
              </Link>
              <button onClick={handleLogout} className="btn btn-primary">
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login"    className="btn btn-outline"  onClick={closeMenu}>Log In</Link>
              <Link to="/register" className="btn btn-primary"  onClick={closeMenu}>Get Started</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
