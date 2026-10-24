import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
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
  const { user } = useAuth();

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const closeMenu  = () => setMenuOpen(false);

  const dashPath = user ? (ROLE_DASHBOARD[user.role] || '/donor/dashboard') : '/donor/dashboard';

  const navLinks = [
    { to: '/',                    label: 'Home'             },
    { to: '/donor/dashboard',     label: 'Donor Portal'     },
    { to: '/ngo/dashboard',       label: 'NGO Portal'       },
    { to: '/volunteer/dashboard', label: 'Volunteer Portal' },
    { to: '/admin/dashboard',     label: 'Admin Portal'     },
    { to: '/about',               label: 'About'            },
    { to: '/contact',             label: 'Contact'          },
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

        {/* Direct Access CTA / Profile Indicator */}
        <div className="navbar__actions">
          <Link to={dashPath} className="navbar__user-info" title="Current Active Portal Profile">
            <span className="navbar__user-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || '🍱'}
            </span>
            <span className="navbar__user-name">{user?.name || 'Active Portal'}</span>
            <span className="navbar__user-role">{ROLE_LABELS[user?.role] || 'Open Access'}</span>
          </Link>
          <Link to="/donor/dashboard" className="btn btn-primary" id="nav-direct-donate">
            🍱 Donate Food
          </Link>
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
          <Link to="/donor/dashboard" className="btn btn-primary" onClick={closeMenu}>
            🍱 Open Donor Portal
          </Link>
          <Link to="/ngo/dashboard" className="btn btn-outline" onClick={closeMenu}>
            🏢 Open NGO Portal
          </Link>
          <Link to="/volunteer/dashboard" className="btn btn-outline" onClick={closeMenu}>
            🙋 Open Volunteer Portal
          </Link>
        </div>
      </div>
    </nav>
  );
}
