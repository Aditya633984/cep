import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BASE_URL } from '../utils/api';
import '../styles/Auth.css';

const ROLE_DASHBOARD = {
  donor:     '/donor/dashboard',
  ngo:       '/ngo/dashboard',
  volunteer: '/volunteer/dashboard',
  admin:     '/admin/dashboard',
};

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [formData,     setFormData]     = useState({ email: '', password: '' });
  const [errors,       setErrors]       = useState({});
  const [touched,      setTouched]      = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [serverError,  setServerError]  = useState('');
  const [sessionNotice, setSessionNotice] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [loading,      setLoading]      = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const isExpired = params.get('expired') === '1';
      const storedExpiredNotice = sessionStorage.getItem('fb_session_expired');
      if (isExpired || storedExpiredNotice) {
        setSessionNotice(storedExpiredNotice || 'Your session has expired. Please log in again.');
        sessionStorage.removeItem('fb_session_expired');
      }

      // Check for registration success message (via router state, sessionStorage, or URL query)
      const isRegistered = params.get('registered') === '1';
      const stateSuccess = location.state?.successMessage;
      const storedSuccess = sessionStorage.getItem('fb_registration_success');
      if (stateSuccess || storedSuccess || isRegistered) {
        setSuccessNotice(
          stateSuccess ||
          storedSuccess ||
          'Registration successful! Please log in with your credentials.'
        );
        sessionStorage.removeItem('fb_registration_success');
      }

      // Pre-fill email from registration if available
      const registeredEmail = location.state?.registeredEmail || sessionStorage.getItem('fb_registered_email');
      if (registeredEmail) {
        setFormData((prev) => ({ ...prev, email: registeredEmail }));
        sessionStorage.removeItem('fb_registered_email');
      }
    } catch {
      // Ignore storage errors
    }
  }, [location]);

  const validateField = (name, value) => {
    switch (name) {
      case 'email': {
        const trimmed = (value || '').trim();
        if (!trimmed) {
          return 'Email address is required.';
        }
        return '';
      }
      case 'password': {
        if (!value) {
          return 'Password is required.';
        }
        return '';
      }
      default:
        return '';
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...formData, [name]: value };
    setFormData(updated);

    if (serverError) setServerError('');

    if (touched[name]) {
      const err = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: err }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const err = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: err }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    const newTouched = { email: true, password: true };
    setTouched(newTouched);

    const emailErr = validateField('email', formData.email);
    const passErr = validateField('password', formData.password);
    const newErrors = { email: emailErr, password: passErr };
    setErrors(newErrors);

    if (emailErr || passErr) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:    formData.email.trim(),
          password: formData.password,
        }),
      });
      let data = {};
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          data = await res.json();
        } catch {
          data = {};
        }
      } else {
        const text = await res.text();
        data = { error: text };
      }

      if (!res.ok) {
        let errorMsg = data.error;
        if (!errorMsg) {
          if (res.status === 401 || res.status === 403) {
            errorMsg = 'Invalid email or password.';
          } else if (res.status === 502 || res.status === 503 || res.status === 504) {
            errorMsg = 'Backend server is temporarily unreachable. Please try again shortly.';
          } else {
            errorMsg = `Server error (${res.status}). Please try again.`;
          }
        }
        setServerError(errorMsg);
        return;
      }

      login(data.token, data.user);
      navigate(ROLE_DASHBOARD[data.user.role] || '/', { replace: true });
    } catch (err) {
      console.error('[Login] Request failed:', err);
      if (err.name === 'AbortError') {
        setServerError('Login request timed out. Please check your internet connection.');
      } else if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
        setServerError('Cannot connect to the FoodBridge API server. Please verify the backend is running and reachable.');
      } else {
        setServerError(err.message || 'Unable to connect to the server. Please check your network connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main id="main-content" className="auth-page">
      <div className="auth-container">

        {/* Header */}
        <div className="auth-header">
          <div className="auth-header__icon" aria-hidden="true">🌉</div>
          <h1 className="auth-header__title">Welcome Back</h1>
          <p className="auth-header__subtitle">
            Log in to your FoodBridge account to continue making a difference.
          </p>
        </div>

        {/* Card */}
        <div className="auth-card" role="main">
          <form onSubmit={handleSubmit} noValidate aria-label="Login form">

            {/* Registration Success Notice */}
            {successNotice && (
              <div
                className="auth-success"
                role="status"
                style={{
                  background: '#F0FDF4',
                  borderColor: '#86EFAC',
                  color: '#166534',
                  marginBottom: '1.25rem',
                }}
              >
                <span>✅</span> {successNotice}
              </div>
            )}

            {/* Session Expiration Notice */}
            {sessionNotice && (
              <div
                className="auth-error"
                role="status"
                style={{
                  background: '#FFFBEB',
                  borderColor: '#FCD34D',
                  color: '#92400E',
                  marginBottom: '1.25rem',
                }}
              >
                <span>⏰</span> {sessionNotice}
              </div>
            )}

            {/* Error Banner */}
            {serverError && (
              <div className="auth-error" role="alert">
                <span>⚠️</span> {serverError}
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email Address</label>
              <input
                id="login-email"
                name="email"
                type="email"
                className={`form-input ${errors.email ? 'form-input--error' : ''}`}
                placeholder="you@gmail.com"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="email"
                required
              />
              {errors.email && (
                <span className="field-error" role="alert">{errors.email}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <div className="password-wrapper">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input ${errors.password ? 'form-input--error' : ''}`}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="current-password"
                  required
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.password && (
                <span className="field-error" role="alert">{errors.password}</span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '-0.5rem', marginBottom: '1.25rem' }}>
              <a href="#" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                Forgot password?
              </a>
            </div>

            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary auth-submit"
              disabled={loading}
            >
              {loading ? 'Logging in…' : 'Log In to FoodBridge'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="auth-footer">
          Don't have an account?{' '}
          <Link to="/register">Create one for free</Link>
        </p>
      </div>
    </main>
  );
}
