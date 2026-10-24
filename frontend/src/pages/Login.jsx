import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

  const [formData,     setFormData]     = useState({ email: '', password: '' });
  const [errors,       setErrors]       = useState({});
  const [touched,      setTouched]      = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [serverError,  setServerError]  = useState('');
  const [loading,      setLoading]      = useState(false);

  // Email verification pending state
  const [isPendingVerification, setIsPendingVerification] = useState(false);
  const [unverifiedEmail,       setUnverifiedEmail]       = useState('');
  const [resendLoading,         setResendLoading]         = useState(false);
  const [resendSuccess,         setResendSuccess]         = useState('');
  const [resendError,           setResendError]           = useState('');
  const [resendCooldown,        setResendCooldown]        = useState(0);

  // Cooldown countdown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

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
    if (resendError) setResendError('');
    if (resendSuccess) setResendSuccess('');

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

  const handleResendVerification = async () => {
    const targetEmail = unverifiedEmail || formData.email.trim();
    if (!targetEmail) {
      setResendError('Please enter your Gmail address above to receive a verification email.');
      return;
    }

    setResendError('');
    setResendSuccess('');
    setResendLoading(true);

    try {
      const res = await fetch(`${BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = await res.json();

      if (!res.ok) {
        setResendError(data.error || 'Failed to resend verification email.');
      } else {
        setResendSuccess('A new verification email has been sent to your Gmail address.');
        setResendCooldown(45);
      }
    } catch {
      setResendError('Network error. Is the server running?');
    } finally {
      setResendLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    setResendSuccess('');
    setResendError('');

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
        if (data.requiresVerification) {
          setIsPendingVerification(true);
          setUnverifiedEmail(formData.email.trim());
        }
        let errorMsg = data.error;
        if (!errorMsg) {
          if (res.status === 401) {
            errorMsg = 'Invalid email or password.';
          } else if (res.status === 403) {
            errorMsg = 'Please verify your email before logging in. Check your inbox for the verification link.';
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

            {/* Error Banner */}
            {serverError && (
              <div className="auth-error" role="alert">
                <span>⚠️</span> {serverError}
              </div>
            )}

            {/* Verification Pending Resend Box */}
            {isPendingVerification && (
              <div className="resend-box-card" style={{ marginBottom: '1.25rem' }}>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                  Didn't receive the verification email{unverifiedEmail ? ` for ${unverifiedEmail}` : ''}? Check your Spam folder or request a new link:
                </p>
                {resendSuccess && (
                  <div className="auth-success" role="status" style={{ marginBottom: 'var(--space-2)' }}>
                    <span>✅</span> {resendSuccess}
                  </div>
                )}
                {resendError && (
                  <div className="auth-error" role="alert" style={{ marginBottom: 'var(--space-2)' }}>
                    <span>⚠️</span> {resendError}
                  </div>
                )}
                <button
                  type="button"
                  id="resend-verification-login-btn"
                  className="btn-secondary-outline"
                  style={{ width: '100%', fontSize: 'var(--font-size-xs)', padding: '0.6rem 0.75rem' }}
                  onClick={handleResendVerification}
                  disabled={resendLoading || resendCooldown > 0}
                >
                  {resendLoading
                    ? 'Sending Email…'
                    : resendCooldown > 0
                    ? `Resend Email in ${resendCooldown}s`
                    : 'Resend Verification Email'}
                </button>
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '-0.5rem', marginBottom: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setIsPendingVerification((p) => !p)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-primary)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {isPendingVerification ? 'Hide verification help' : 'Resend verification email?'}
              </button>
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
