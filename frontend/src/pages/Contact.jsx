import { useState } from 'react';
import '../styles/About.css';
import '../styles/Contact.css';

const CONTACT_DETAILS = [
  { icon: '📧', label: 'Email',    value: 'hello@foodbridge.org' },
  { icon: '📞', label: 'Phone',    value: '+91 98765 43210'      },
  { icon: '📍', label: 'Address',  value: '123 Bridge Street, Bangalore, Karnataka 560001' },
  { icon: '🕐', label: 'Hours',    value: 'Mon – Sat: 9 AM – 6 PM IST' },
];

export default function Contact() {
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    subject: '', message: '', role: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Placeholder – no API call yet
    setSubmitted(true);
  };

  return (
    <main id="main-content" className="contact-page">

      {/* Page Header */}
      <header className="page-header">
        <div className="container">
          <p className="page-header__label">Get In Touch</p>
          <h1 className="page-header__title">Contact Us</h1>
          <p className="page-header__subtitle">
            Have a question, partnership inquiry, or just want to say hello?
            We'd love to hear from you.
          </p>
        </div>
      </header>

      <div className="container">
        <div className="contact-layout">

          {/* Info Panel */}
          <aside aria-label="Contact information">
            <h2 className="contact-info__title">Let's Connect</h2>
            <p className="contact-info__desc">
              Whether you're a potential donor, an NGO looking to partner, or a
              volunteer wanting to learn more — our team is here to help.
            </p>

            <div className="contact-details">
              {CONTACT_DETAILS.map(({ icon, label, value }) => (
                <div className="contact-detail" key={label}>
                  <div className="contact-detail__icon-wrap" aria-hidden="true">{icon}</div>
                  <div>
                    <p className="contact-detail__label">{label}</p>
                    <p className="contact-detail__value">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* Form Card */}
          <div className="contact-form-card">
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>
                  Message Sent!
                </h2>
                <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                  Thank you for reaching out. Our team will get back to you
                  within 1–2 business days.
                </p>
                <button
                  className="btn btn-outline"
                  style={{ marginTop: '1.5rem' }}
                  onClick={() => { setSubmitted(false); setFormData({ firstName: '', lastName: '', email: '', phone: '', subject: '', message: '', role: '' }); }}
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <>
                <h2 className="contact-form-card__title">Send Us a Message</h2>
                <form onSubmit={handleSubmit} noValidate aria-label="Contact form">

                  <div className="contact-form__row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="contact-firstName">First Name *</label>
                      <input
                        id="contact-firstName"
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
                      <label className="form-label" htmlFor="contact-lastName">Last Name *</label>
                      <input
                        id="contact-lastName"
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

                  <div className="contact-form__row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="contact-email">Email *</label>
                      <input
                        id="contact-email"
                        name="email"
                        type="email"
                        className="form-input"
                        placeholder="jane@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="contact-phone">Phone</label>
                      <input
                        id="contact-phone"
                        name="phone"
                        type="tel"
                        className="form-input"
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="contact-role">I am a…</label>
                    <select
                      id="contact-role"
                      name="role"
                      className="form-select"
                      value={formData.role}
                      onChange={handleChange}
                    >
                      <option value="">Select your role</option>
                      <option value="donor">Food Donor</option>
                      <option value="ngo">NGO / Organisation</option>
                      <option value="volunteer">Volunteer</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="contact-subject">Subject *</label>
                    <input
                      id="contact-subject"
                      name="subject"
                      type="text"
                      className="form-input"
                      placeholder="How can we help?"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="contact-message">Message *</label>
                    <textarea
                      id="contact-message"
                      name="message"
                      className="form-textarea"
                      rows={5}
                      placeholder="Write your message here…"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  <button
                    id="contact-submit"
                    type="submit"
                    className="btn btn-primary contact-form__submit"
                  >
                    Send Message →
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
