import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BASE_URL } from '../utils/api';
import '../styles/Auth.css';

const ROLES = [
  { value: 'donor',     icon: '🍱', label: 'Donor'     },
  { value: 'ngo',       icon: '🏢', label: 'NGO'       },
  { value: 'volunteer', icon: '🚗', label: 'Volunteer'  },
];

const ROLE_DASHBOARD = {
  donor:     '/donor/dashboard',
  ngo:       '/ngo/dashboard',
  volunteer: '/volunteer/dashboard',
  admin:     '/admin/dashboard',
};

const FOOD_TYPE_OPTIONS = [
  'Cooked Food', 'Raw Groceries', 'Packaged Food',
  'Dairy Products', 'Bakery Items', 'Beverages', 'Fruits & Vegetables',
];

export default function Register() {
  const { login }  = useAuth();
  const navigate   = useNavigate();

  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'donor',
    terms: false,
    // NGO extra fields
    ngoName: '',
    founder: '',
    address: '',
    foodTypes: [],
    // Volunteer extra fields
    vehicleType: 'motorcycle',
    serviceArea: '',
    availability: '',
  });

  const [errors,                setErrors]                = useState({});
  const [touched,               setTouched]               = useState({});
  const [showPassword,          setShowPassword]          = useState(false);
  const [showConfirmPassword,   setShowConfirmPassword]   = useState(false);
  const [serverError,           setServerError]           = useState('');
  const [successMsg,            setSuccessMsg]            = useState('');
  const [loading,               setLoading]               = useState(false);

  // ── Validation Helper ───────────────────────────────────────────────────────
  const validateField = (name, value, allData) => {
    switch (name) {
      case 'fullName': {
        const trimmed = (value || '').trim();
        if (!trimmed) {
          return 'Full Name can contain only English letters and spaces.';
        }
        const nameRegex = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
        if (!nameRegex.test(trimmed)) {
          return 'Full Name can contain only English letters and spaces.';
        }
        return '';
      }

      case 'username': {
        const trimmed = (value || '').trim();
        if (!trimmed) {
          return 'Username can contain only English letters and spaces.';
        }
        const usernameRegex = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
        if (!usernameRegex.test(trimmed)) {
          return 'Username can contain only English letters and spaces.';
        }
        return '';
      }

      case 'phone': {
        if (!value || typeof value !== 'string' || !value.trim()) {
          return 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.';
        }
        const phoneRegex = /^[6-9][0-9]{9}$/;
        if (!phoneRegex.test(value)) {
          return 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.';
        }
        return '';
      }

      case 'email': {
        const trimmed = (value || '').trim();
        if (!trimmed) {
          return 'Enter a valid Gmail address ending with @gmail.com.';
        }
        const gmailRegex = /^[A-Za-z0-9._%+-]+@gmail\.com$/;
        if (!gmailRegex.test(trimmed)) {
          return 'Enter a valid Gmail address ending with @gmail.com.';
        }
        return '';
      }

      case 'password': {
        if (!value) {
          return 'Password is required.';
        }
        if (value.length < 8) {
          return 'Password must be at least 8 characters.';
        }
        return '';
      }

      case 'confirmPassword': {
        if (!value) {
          return 'Please confirm your password.';
        }
        const currentPassword = allData ? allData.password : formData.password;
        if (value !== currentPassword) {
          return 'Passwords do not match.';
        }
        return '';
      }

      case 'ngoName': {
        const currentRole = allData ? allData.role : formData.role;
        if (currentRole === 'ngo' && (!value || !String(value).trim())) {
          return 'NGO Name is required.';
        }
        return '';
      }

      case 'terms': {
        if (!value) {
          return 'You must agree to the Terms of Service.';
        }
        return '';
      }

      default:
        return '';
    }
  };

  // ── Input Handlers ──────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;
    const updatedForm = { ...formData, [name]: fieldValue };
    setFormData(updatedForm);

    if (serverError) setServerError('');

    // Re-validate on change so feedback is immediate, especially for fullName and username
    if (touched[name] || name === 'fullName' || name === 'username') {
      const fieldErr = validateField(name, fieldValue, updatedForm);
      if (touched[name] || (fieldValue && fieldErr)) {
        setErrors((prev) => ({ ...prev, [name]: fieldErr }));
      } else if (!fieldErr) {
        setErrors((prev) => ({ ...prev, [name]: '' }));
      }
    }

    // If password changed, update confirmPassword error if confirmPassword was touched
    if (name === 'password' && touched.confirmPassword) {
      const confirmErr = validateField('confirmPassword', formData.confirmPassword, updatedForm);
      setErrors((prev) => ({ ...prev, confirmPassword: confirmErr }));
    }
  };

  const handlePhoneChange = (e) => {
    // Prevent non-digit characters from being entered where practical
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
    const updatedForm = { ...formData, phone: digitsOnly };
    setFormData(updatedForm);

    if (serverError) setServerError('');

    if (touched.phone) {
      const phoneErr = validateField('phone', digitsOnly, updatedForm);
      setErrors((prev) => ({ ...prev, phone: phoneErr }));
    }
  };

  const handleBlur = (e) => {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;
    setTouched((prev) => ({ ...prev, [name]: true }));

    const fieldErr = validateField(name, fieldValue, formData);
    setErrors((prev) => ({ ...prev, [name]: fieldErr }));
  };

  const handleFoodTypeToggle = (type) => {
    setFormData((prev) => {
      const already = prev.foodTypes.includes(type);
      return {
        ...prev,
        foodTypes: already
          ? prev.foodTypes.filter((t) => t !== type)
          : [...prev.foodTypes, type],
      };
    });
  };

  // ── Form Submission ─────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    setSuccessMsg('');

    // Mark all required fields as touched
    const allTouched = {
      fullName: true,
      username: true,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true,
      terms: true,
      ...(formData.role === 'ngo' && { ngoName: true }),
    };
    setTouched(allTouched);

    // Run comprehensive validation on all fields
    const newErrors = {};
    newErrors.fullName = validateField('fullName', formData.fullName, formData);
    newErrors.username = validateField('username', formData.username, formData);
    newErrors.email = validateField('email', formData.email, formData);
    newErrors.phone = validateField('phone', formData.phone, formData);
    newErrors.password = validateField('password', formData.password, formData);
    newErrors.confirmPassword = validateField('confirmPassword', formData.confirmPassword, formData);
    newErrors.terms = validateField('terms', formData.terms, formData);
    if (formData.role === 'ngo') {
      newErrors.ngoName = validateField('ngoName', formData.ngoName, formData);
    }

    setErrors(newErrors);

    // Prevent submission if any error exists
    const hasAnyError = Object.values(newErrors).some((err) => Boolean(err));
    if (hasAnyError) {
      return;
    }

    setLoading(true);

    const payload = {
      fullName: (formData.fullName || formData.username).trim(),
      name:     (formData.fullName || formData.username).trim(),
      username: formData.username.trim(),
      email:    formData.email.trim(),
      phone:    formData.phone.trim(),
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      role:     formData.role,
      ...(formData.role === 'ngo' && {
        ngo_name:   formData.ngoName.trim(),
        founder:    formData.founder.trim(),
        address:    formData.address.trim(),
        food_types: formData.foodTypes.join(', '),
      }),
      ...(formData.role === 'volunteer' && {
        vehicle_type: formData.vehicleType,
        service_area: formData.serviceArea.trim(),
        availability: formData.availability.trim(),
      }),
    };

    try {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
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
          if (res.status === 400) {
            errorMsg = 'Invalid registration data. Please review the highlighted fields.';
          } else if (res.status === 409) {
            errorMsg = 'An account with this email, phone, or username already exists.';
          } else if (res.status === 405) {
            errorMsg = 'Endpoint method not allowed (HTTP 405). Please verify backend deployment.';
          } else if (res.status === 502 || res.status === 503 || res.status === 504) {
            errorMsg = 'Backend server is temporarily unreachable (HTTP ' + res.status + '). Please try again in a moment.';
          } else {
            errorMsg = `Server returned error (${res.status}). Please try again.`;
          }
        }

        console.error('[Register] Backend error:', errorMsg);
        setServerError(errorMsg);

        // Highlight specific field if duplicate error returned
        if (errorMsg.toLowerCase().includes('already exists') && errorMsg.toLowerCase().includes('email')) {
          setErrors((prev) => ({ ...prev, email: errorMsg }));
        } else if (errorMsg.toLowerCase().includes('already exists') && errorMsg.toLowerCase().includes('phone')) {
          setErrors((prev) => ({ ...prev, phone: errorMsg }));
        } else if (errorMsg.toLowerCase().includes('already exists') && errorMsg.toLowerCase().includes('username')) {
          setErrors((prev) => ({ ...prev, username: errorMsg }));
        }
        return;
      }

      setSuccessMsg('Registration successful! Welcome to FoodBridge. Redirecting to your dashboard…');
      setTimeout(() => {
        if (data.token && data.user) {
          login(data.token, data.user);
          navigate(ROLE_DASHBOARD[data.user.role] || '/', { replace: true });
        } else {
          navigate('/login', { replace: true });
        }
      }, 1000);
    } catch (err) {
      console.error('[Register] Network request failed:', err);
      if (err.name === 'AbortError') {
        setServerError('Registration request timed out. Please check your internet connection.');
      } else if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
        setServerError('Cannot connect to the FoodBridge API server. Please verify that the backend is running and reachable.');
      } else {
        setServerError(err.message || 'Unable to connect to the server. Please check your network connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const isNgo = formData.role === 'ngo';
  const isVolunteer = formData.role === 'volunteer';

  return (
    <main id="main-content" className="auth-page" style={{ alignItems: 'flex-start', paddingTop: '2.5rem' }}>
      <div className="auth-container" style={{ maxWidth: '520px' }}>
        {/* Header */}
        <div className="auth-header">
          <div className="auth-header__icon" aria-hidden="true">🌉</div>
          <h1 className="auth-header__title">Create Your Account</h1>
          <p className="auth-header__subtitle">
            Join FoodBridge and start making an impact in your community.
          </p>
        </div>

            {/* Card */}
            <div className="auth-card">
              <form onSubmit={handleSubmit} noValidate aria-label="Register form">

                {/* Success Banner */}
                {successMsg && (
                  <div className="auth-success" role="status">
                    <span>✅</span> {successMsg}
                  </div>
                )}

                {/* Error Banner */}
                {serverError && (
                  <div className="auth-error" role="alert">
                    <span>⚠️</span>
                    <div>{serverError}</div>
                  </div>
                )}

            {/* Role Selector */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <p className="form-label" id="role-group-label">I want to join as a…</p>
              <div className="role-selector" role="radiogroup" aria-labelledby="role-group-label">
                {ROLES.map(({ value, icon, label }) => (
                  <div className="role-option" key={value}>
                    <input
                      type="radio"
                      id={`role-${value}`}
                      name="role"
                      value={value}
                      checked={formData.role === value}
                      onChange={handleChange}
                    />
                    <label className="role-option__label" htmlFor={`role-${value}`}>
                      <span className="role-option__icon">{icon}</span>
                      <span className="role-option__text">{label}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Full Name Input */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-fullname">Full Name *</label>
              <input
                id="reg-fullname"
                name="fullName"
                type="text"
                className={`form-input ${errors.fullName ? 'form-input--error' : ''}`}
                placeholder="e.g. Aditya Sharma"
                value={formData.fullName}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="name"
                required
              />
              {errors.fullName ? (
                <span className="field-error" role="alert">{errors.fullName}</span>
              ) : (
                <p className="form-hint">English alphabet letters and spaces only (A–Z, a–z).</p>
              )}
            </div>

            {/* Username Input */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-username">Username *</label>
              <input
                id="reg-username"
                name="username"
                type="text"
                className={`form-input ${errors.username ? 'form-input--error' : ''}`}
                placeholder="e.g. Aditya"
                value={formData.username}
                onChange={handleChange}
                onBlur={handleBlur}
                autoComplete="username"
                required
              />
              {errors.username ? (
                <span className="field-error" role="alert">{errors.username}</span>
              ) : (
                <p className="form-hint">English alphabet letters and spaces only (A–Z, a–z).</p>
              )}
            </div>

            {/* Gmail Input */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">Gmail Address *</label>
              <input
                id="reg-email"
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
              {errors.email ? (
                <span className="field-error" role="alert">{errors.email}</span>
              ) : (
                <p className="form-hint">Must be an active address ending in @gmail.com</p>
              )}
            </div>

            {/* Phone Input */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-phone">Phone Number *</label>
              <input
                id="reg-phone"
                name="phone"
                type="text"
                inputMode="numeric"
                maxLength={10}
                className={`form-input ${errors.phone ? 'form-input--error' : ''}`}
                placeholder="9876543210"
                value={formData.phone}
                onChange={handlePhoneChange}
                onBlur={handleBlur}
                autoComplete="tel"
                required
              />
              {errors.phone ? (
                <span className="field-error" role="alert">{errors.phone}</span>
              ) : (
                <p className="form-hint">10-digit Indian mobile number starting with 6, 7, 8, or 9</p>
              )}
            </div>

            {/* ── NGO Extra Fields (conditional) ───────────────────────────── */}
            {isNgo && (
              <div className="ngo-fields">
                <div className="ngo-fields__header">
                  <span>🏢</span>
                  <span>NGO Details</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reg-ngoName">NGO Name *</label>
                  <input
                    id="reg-ngoName"
                    name="ngoName"
                    type="text"
                    className={`form-input ${errors.ngoName ? 'form-input--error' : ''}`}
                    placeholder="Hope Foundation"
                    value={formData.ngoName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    required
                  />
                  {errors.ngoName && (
                    <span className="field-error" role="alert">{errors.ngoName}</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reg-founder">Founder Name</label>
                  <input
                    id="reg-founder"
                    name="founder"
                    type="text"
                    className="form-input"
                    placeholder="Dr. Asha Mehta"
                    value={formData.founder}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reg-address">Address</label>
                  <input
                    id="reg-address"
                    name="address"
                    type="text"
                    className="form-input"
                    placeholder="123 Main St, Indiranagar, Bangalore"
                    value={formData.address}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <p className="form-label">Food Types Accepted</p>
                  <div className="food-types-grid">
                    {FOOD_TYPE_OPTIONS.map((type) => (
                      <label key={type} className="food-type-chip">
                        <input
                          type="checkbox"
                          checked={formData.foodTypes.includes(type)}
                          onChange={() => handleFoodTypeToggle(type)}
                        />
                        <span>{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Volunteer Extra Fields (conditional) ─────────────────────── */}
            {isVolunteer && (
              <div className="ngo-fields">
                <div className="ngo-fields__header">
                  <span>🚗</span>
                  <span>Volunteer Details</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reg-vehicleType">Vehicle Type *</label>
                  <select
                    id="reg-vehicleType"
                    name="vehicleType"
                    className="form-input"
                    value={formData.vehicleType}
                    onChange={handleChange}
                    required
                  >
                    <option value="bicycle">🚲 Bicycle</option>
                    <option value="motorcycle">🏍️ Motorcycle</option>
                    <option value="car">🚗 Car</option>
                    <option value="van">🚐 Van</option>
                    <option value="truck">🚚 Truck</option>
                    <option value="other">🚛 Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reg-serviceArea">Service Area</label>
                  <input
                    id="reg-serviceArea"
                    name="serviceArea"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Indiranagar, Koramangala, CBD"
                    value={formData.serviceArea}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reg-availability">Availability</label>
                  <input
                    id="reg-availability"
                    name="availability"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Weekdays 9AM–6PM"
                    value={formData.availability}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">Password *</label>
              <div className="password-wrapper">
                <input
                  id="reg-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input ${errors.password ? 'form-input--error' : ''}`}
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="new-password"
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
              {errors.password ? (
                <span className="field-error" role="alert">{errors.password}</span>
              ) : (
                <p className="form-hint">Minimum 8 characters</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-confirm-password">Confirm Password *</label>
              <div className="password-wrapper">
                <input
                  id="reg-confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className={`form-input ${errors.confirmPassword ? 'form-input--error' : ''}`}
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="new-password"
                  required
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword((s) => !s)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.confirmPassword && (
                <span className="field-error" role="alert">{errors.confirmPassword}</span>
              )}
            </div>

            {/* Terms */}
            <div className="auth-terms" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                <input
                  id="reg-terms"
                  name="terms"
                  type="checkbox"
                  checked={formData.terms}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                />
                <label htmlFor="reg-terms" className="auth-terms__text">
                  I agree to FoodBridge's{' '}
                  <a href="#">Terms of Service</a> and{' '}
                  <a href="#">Privacy Policy</a>
                </label>
              </div>
              {errors.terms && (
                <span className="field-error" style={{ marginLeft: '1.75rem' }} role="alert">
                  {errors.terms}
                </span>
              )}
            </div>

            <button
              id="register-submit"
              type="submit"
              className="btn btn-primary auth-submit"
              disabled={loading || Boolean(successMsg)}
            >
              {loading ? 'Creating account…' : 'Create Account →'}
            </button>
          </form>
        </div>

        <p className="auth-footer">
          Already have an account?{' '}
          <Link to="/login">Log in here</Link>
        </p>
      </div>
    </main>
  );
}
