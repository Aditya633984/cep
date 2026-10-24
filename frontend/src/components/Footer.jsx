import { Link } from 'react-router-dom';
import '../styles/Footer.css';

const QUICK_LINKS = [
  { to: '/',        label: 'Home'      },
  { to: '/about',   label: 'About Us'  },
  { to: '/contact', label: 'Contact'   },
];

const GET_INVOLVED = [
  { to: '/donor/dashboard',     label: 'Donor Portal'     },
  { to: '/volunteer/dashboard', label: 'Volunteer Portal' },
  { to: '/ngo/dashboard',       label: 'NGO Portal'       },
  { to: '/admin/dashboard',     label: 'Admin Portal'     },
];

const SUPPORT = [
  { to: '/contact', label: 'Help Center'    },
  { to: '/about',   label: 'Our Mission'    },
  { to: '/contact', label: 'Partner With Us'},
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer" role="contentinfo">
      <div className="container">
        <div className="footer__grid">

          {/* Brand */}
          <div className="footer__brand">
            <Link to="/" className="footer__logo" aria-label="FoodBridge">
              <div className="footer__logo-icon" aria-hidden="true">🌉</div>
              <span className="footer__logo-text">FoodBridge</span>
            </Link>
            <p className="footer__tagline">
              Connecting surplus food with the people who need it most.
              Together, we reduce waste and fight hunger — one meal at a time.
            </p>
            <div className="footer__social" aria-label="Social media links">
              {['📘', '🐦', '📸', '💼'].map((icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="footer__social-link"
                  aria-label={['Facebook', 'Twitter', 'Instagram', 'LinkedIn'][i]}
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="footer__col-title">Quick Links</h3>
            <ul className="footer__links" role="list">
              {QUICK_LINKS.map(({ to, label }) => (
                <li key={label}>
                  <Link to={to} className="footer__link">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Get Involved */}
          <div>
            <h3 className="footer__col-title">Get Involved</h3>
            <ul className="footer__links" role="list">
              {GET_INVOLVED.map(({ to, label }) => (
                <li key={label}>
                  <Link to={to} className="footer__link">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="footer__col-title">Support</h3>
            <ul className="footer__links" role="list">
              {SUPPORT.map(({ to, label }) => (
                <li key={label}>
                  <Link to={to} className="footer__link">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer__bottom">
          <p className="footer__copyright">
            © {year} FoodBridge. All rights reserved.
          </p>
          <nav className="footer__bottom-links" aria-label="Legal links">
            <a href="#" className="footer__bottom-link">Privacy Policy</a>
            <a href="#" className="footer__bottom-link">Terms of Service</a>
            <a href="#" className="footer__bottom-link">Cookie Policy</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
