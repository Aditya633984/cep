import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BASE_URL } from '../utils/api';
import '../styles/Auth.css';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const initialVerified = searchParams.get('verified') === 'true';

  const [status, setStatus] = useState(initialVerified ? 'success' : 'loading'); // 'loading' | 'success' | 'expired' | 'used' | 'invalid' | 'missing'
  const [errorMessage, setErrorMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const [resendError, setResendError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const hasFetchedRef = useRef(false);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (initialVerified) {
      setStatus('success');
      return;
    }

    if (!token) {
      setStatus('missing');
      return;
    }

    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    async function verify() {
      try {
        const res = await fetch(`${BASE_URL}/auth/verify-email?token=${encodeURIComponent(token)}`, {
          headers: { Accept: 'application/json' },
        });
        const data = await res.json();

        if (res.ok && data.success) {
          setStatus('success');
        } else {
          const err = data.error || 'Verification failed.';
          setErrorMessage(err);

          if (err.toLowerCase().includes('expired')) {
            setStatus('expired');
          } else if (err.toLowerCase().includes('already been used')) {
            setStatus('used');
          } else {
            setStatus('invalid');
          }
        }
      } catch {
        setStatus('invalid');
        setErrorMessage('Network error while verifying token. Please check your internet connection.');
      }
    }

    verify();
  }, [token, initialVerified]);

  const handleResend = async (e) => {
    e.preventDefault();
    setResendError('');
    setResendSuccess('');

    const cleanEmail = (resendEmail || '').trim().toLowerCase();
    if (!cleanEmail) {
      setResendError('Please enter your Gmail address.');
      return;
    }

    const gmailRegex = /^[A-Za-z0-9._%+-]+@gmail\.com$/;
    if (!gmailRegex.test(cleanEmail)) {
      setResendError('Please enter a valid Gmail address ending in @gmail.com.');
      return;
    }

    setResendLoading(true);

    try {
      const res = await fetch(`${BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();

      if (!res.ok) {
        setResendError(data.error || 'Failed to resend verification email.');
      } else {
        setResendSuccess('Verification email sent! Please check your Gmail inbox and click the new link.');
        setResendCooldown(45);
      }
    } catch {
      setResendError('Network error. Is the server running?');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <main id="main-content" className="auth-page">
      <div className="auth-container" style={{ maxWidth: '520px' }}>

        {/* Brand Header */}
        <div className="auth-header">
          <div className="auth-header__icon" aria-hidden="true">🌉</div>
          <h1 className="auth-header__title">FoodBridge Verification</h1>
          <p className="auth-header__subtitle">
            Connecting surplus food with those who need it most.
          </p>
        </div>

        {/* Card */}
        <div className="auth-card verification-card">

          {/* 1. LOADING STATE */}
          {status === 'loading' && (
            <div>
              <div className="verification-status-icon verification-status-icon--pending">
                <span className="verification-spinner" aria-hidden="true" />
              </div>
              <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                Verifying Your Email Address…
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                Please wait while we validate your verification token.
              </p>
            </div>
          )}

          {/* 2. SUCCESS STATE */}
          {status === 'success' && (
            <div>
              <div className="verification-status-icon verification-status-icon--success" aria-hidden="true">
                ✓
              </div>
              <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: '#166534', marginBottom: 'var(--space-3)' }}>
                Email Verified Successfully!
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)', lineHeight: 1.6, marginBottom: 'var(--space-6)' }}>
                Your FoodBridge account is now verified. You can log in and start connecting surplus food with communities in need.
              </p>

              <div className="verification-actions">
                <Link
                  id="verified-login-btn"
                  to="/login"
                  className="btn btn-primary"
                  style={{ textDecoration: 'none', padding: '0.875rem' }}
                >
                  Log In to FoodBridge →
                </Link>
              </div>
            </div>
          )}

          {/* 3. EXPIRED STATE */}
          {status === 'expired' && (
            <div>
              <div className="verification-status-icon verification-status-icon--warning" aria-hidden="true">
                ⏳
              </div>
              <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: '#92400E', marginBottom: 'var(--space-2)' }}>
                Verification Link Expired
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.6, marginBottom: 'var(--space-5)' }}>
                {errorMessage || 'For your security, verification links expire after 15 minutes. Please enter your Gmail address below to receive a new link.'}
              </p>

              {resendSuccess && (
                <div className="auth-success" role="status">
                  <span>✅</span> {resendSuccess}
                </div>
              )}

              {resendError && (
                <div className="auth-error" role="alert">
                  <span>⚠️</span> {resendError}
                </div>
              )}

              <form onSubmit={handleResend} className="resend-box-card" noValidate>
                <label htmlFor="expired-resend-email" className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>
                  Your Registered Gmail Address
                </label>
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  <input
                    id="expired-resend-email"
                    type="email"
                    className="form-input"
                    placeholder="you@gmail.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={resendLoading || resendCooldown > 0}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {resendLoading ? 'Sending…' : resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Send New Link'}
                  </button>
                </div>
              </form>

              <div className="verification-actions">
                <Link to="/login" className="btn-secondary-outline">
                  Back to Login
                </Link>
              </div>
            </div>
          )}

          {/* 4. ALREADY USED STATE */}
          {status === 'used' && (
            <div>
              <div className="verification-status-icon verification-status-icon--pending" aria-hidden="true">
                ℹ️
              </div>
              <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                Link Already Used
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.6, marginBottom: 'var(--space-6)' }}>
                This email verification link has already been used. If your account is verified, you can proceed directly to log in.
              </p>

              <div className="verification-actions">
                <Link to="/login" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                  Go to Login →
                </Link>
                <Link to="/register" className="btn-secondary-outline">
                  Create a New Account
                </Link>
              </div>
            </div>
          )}

          {/* 5. INVALID OR MISSING TOKEN STATE */}
          {(status === 'invalid' || status === 'missing') && (
            <div>
              <div className="verification-status-icon verification-status-icon--error" aria-hidden="true">
                ✕
              </div>
              <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: '#991B1B', marginBottom: 'var(--space-2)' }}>
                Invalid Verification Link
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.6, marginBottom: 'var(--space-5)' }}>
                {errorMessage || 'The verification link you clicked is invalid or has expired. You can request a fresh verification link below.'}
              </p>

              {resendSuccess && (
                <div className="auth-success" role="status">
                  <span>✅</span> {resendSuccess}
                </div>
              )}

              {resendError && (
                <div className="auth-error" role="alert">
                  <span>⚠️</span> {resendError}
                </div>
              )}

              <form onSubmit={handleResend} className="resend-box-card" noValidate>
                <label htmlFor="invalid-resend-email" className="form-label" style={{ fontSize: 'var(--font-size-xs)' }}>
                  Request New Verification Link
                </label>
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  <input
                    id="invalid-resend-email"
                    type="email"
                    className="form-input"
                    placeholder="you@gmail.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={resendLoading || resendCooldown > 0}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {resendLoading ? 'Sending…' : resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Send Link'}
                  </button>
                </div>
              </form>

              <div className="verification-actions">
                <Link to="/login" className="btn-secondary-outline">
                  Back to Login
                </Link>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <p className="auth-footer" style={{ marginTop: 'var(--space-6)' }}>
          Need assistance? <Link to="/contact">Contact FoodBridge Support</Link>
        </p>

      </div>
    </main>
  );
}
