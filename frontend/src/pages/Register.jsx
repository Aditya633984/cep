import { useState } from 'react';
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
    firstName: '', lastName: '', email: '',
    phone: '', password: '', confirmPassword: '',
    role: 'donor', terms: false,
    // NGO extra fields
    ngoName: '', founder: '', address: '', foodTypes: [],
    // Volunteer extra fields
    vehicleType: 'motorcycle', serviceArea: '', availability: '',
  });

  const [showPassword,        setShowPassword]        = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error,               setError]               = useState('');
  const [loading,             setLoading]             = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (error) setError('');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!formData.terms) {
      setError('You must agree to the Terms of Service.');
      return;
    }
    if (formData.role === 'ngo' && !formData.ngoName.trim()) {
      setError('NGO Name is required.');
      return;
    }

    setLoading(true);

    const payload = {
      name:     `${formData.firstName.trim()} ${formData.lastName.trim()}`,
      email:    formData.email.trim(),
      phone:    formData.phone.trim(),
      password: formData.password,
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
      const res  = await fetch(`${BASE_URL}/auth/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed. Please try again.');
        return;
      }

      login(data.token, data.user);
      navigate(ROLE_DASHBOARD[data.user.role] || '/', { replace: true });
    } catch {
      setError('Network error. Is the server running?');
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

            {/* Error Banner */}
            {error && (
              <div className="auth-error" role="alert">
                <span>⚠️</span> {error}
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

            {/* Name Row */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="reg-firstName">First Name *</label>
                <input
                  id="reg-firstName"
                  name="firstName"
                  type="text"
                  className="form-input"
                  placeholder="Jane"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-lastName">Last Name *</label>
                <input
                  id="reg-lastName"
                  name="lastName"
                  type="text"
                  className="form-input"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">Email Address *</label>
              <input
                id="reg-email"
                name="email"
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>

            {/* Phone */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-phone">Phone Number</label>
              <input
                id="reg-phone"
                name="phone"
                type="tel"
                className="form-input"
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={handleChange}
              />
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
                    className="form-input"
                    placeholder="Hope Foundation"
                    value={formData.ngoName}
                    onChange={handleChange}
                    required
                  />
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
                    placeholder="123 Main St, Mumbai, Maharashtra"
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
                    placeholder="e.g. Andheri, Bandra, Juhu"
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
                  className="form-input"
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={handleChange}
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
              <p className="form-hint">Minimum 8 characters</p>
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-confirm-password">Confirm Password *</label>
              <div className="password-wrapper">
                <input
                  id="reg-confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
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
            </div>

            {/* Terms */}
            <div className="auth-terms">
              <input
                id="reg-terms"
                name="terms"
                type="checkbox"
                checked={formData.terms}
                onChange={handleChange}
                required
              />
              <label htmlFor="reg-terms" className="auth-terms__text">
                I agree to FoodBridge's{' '}
                <a href="#">Terms of Service</a> and{' '}
                <a href="#">Privacy Policy</a>
              </label>
            </div>

            <button
              id="register-submit"
              type="submit"
              className="btn btn-primary auth-submit"
              disabled={loading}
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
