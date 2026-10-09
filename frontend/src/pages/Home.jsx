import { Link } from 'react-router-dom';
import '../styles/Home.css';

// ─── Data ────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    number: '1',
    icon: '🍱',
    title: 'List Your Surplus',
    desc: 'Donors register surplus food with details like quantity, type, and pickup location. Listing takes less than 2 minutes.',
  },
  {
    number: '2',
    icon: '🚗',
    title: 'Volunteers Collect',
    desc: `Verified volunteers nearby receive a notification and pick up the food from the donor's location at a scheduled time.`,
  },
  {
    number: '3',
    icon: '🤝',
    title: 'NGOs Distribute',
    desc: 'Partner NGOs receive the collected food and redistribute it efficiently to communities and individuals in need.',
  },
];

const IMPACT_STATS = [
  { icon: '🍽️', number: '12,000+', label: 'Meals Redistributed', sub: 'and counting' },
  { icon: '👥', number: '850+',    label: 'Active Donors',        sub: 'across cities'  },
  { icon: '🏢', number: '60+',     label: 'Partner NGOs',         sub: 'nationwide'     },
  { icon: '🙋', number: '430+',    label: 'Volunteers',           sub: 'ready to help'  },
];

const ABOUT_CARDS = [
  {
    icon: '🌱',
    title: 'Reduce Food Waste',
    desc: 'Tons of edible food is discarded daily. FoodBridge ensures it reaches those who need it instead.',
  },
  {
    icon: '🤲',
    title: 'Fight Hunger',
    desc: 'Our network connects surplus directly to communities facing food insecurity across the country.',
  },
  {
    icon: '🔗',
    title: 'Build Community',
    desc: 'We bring donors, volunteers, and NGOs together into a trusted, transparent ecosystem.',
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <main id="main-content">

      {/* ── Hero ── */}
      <section className="hero" aria-labelledby="hero-heading">
        <div className="container hero__inner">
          <div className="hero__content">
            <div className="hero__badge">
              <span className="badge badge-primary" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>
                🌍 Making a difference, one meal at a time
              </span>
            </div>

            <h1 className="hero__title" id="hero-heading">
              Bridging Surplus Food<br />
              to <span>Those Who Need It</span>
            </h1>

            <p className="hero__subtitle">
              FoodBridge connects restaurants, households, and businesses with
              NGOs and volunteers to redistribute surplus food — reducing waste
              and fighting hunger in your community.
            </p>

            <div className="hero__actions">
              <Link to="/register" id="cta-donate" className="btn btn-accent btn-lg">
                🍱 Donate Food
              </Link>
              <Link to="/register" id="cta-volunteer" className="btn btn-outline-white btn-lg">
                🙋 Join as Volunteer
              </Link>
            </div>
          </div>

          <div className="hero__visual">
            <div className="hero__illustration">
              <div className="hero__illustration-icon">🌉</div>
              <p className="hero__illustration-text">
                Connecting donors, volunteers,<br />and NGOs across the country
              </p>
              <div className="hero__stat-row">
                <div className="hero__stat">
                  <div className="hero__stat-number">12K+</div>
                  <div className="hero__stat-label">Meals Saved</div>
                </div>
                <div className="hero__stat">
                  <div className="hero__stat-number">60+</div>
                  <div className="hero__stat-label">NGOs</div>
                </div>
                <div className="hero__stat">
                  <div className="hero__stat-number">430+</div>
                  <div className="hero__stat-label">Volunteers</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── About FoodBridge ── */}
      <section className="about-section" aria-labelledby="about-heading">
        <div className="container about-section__inner">
          <div>
            <p className="about-section__label">What We Do</p>
            <h2 className="about-section__title" id="about-heading">
              A Platform Built to<br />End Food Waste
            </h2>
            <p className="about-section__body">
              Every day, enormous amounts of perfectly good food go to waste while
              millions of people face hunger. FoodBridge is a technology-powered
              platform that bridges this gap by making food donation simple,
              fast, and transparent.
            </p>
            <p className="about-section__body">
              Whether you're a restaurant with leftover meals, a household with
              extra groceries, or an event organiser with surplus food — FoodBridge
              makes it effortless to connect with nearby NGOs and volunteers.
            </p>
            <div className="about-section__features">
              {[
                'Free and easy to use for all parties',
                'Real-time donation tracking',
                'Verified NGO and volunteer network',
                'Impact reports for donors',
              ].map((feat) => (
                <div className="about-feature" key={feat}>
                  <div className="about-feature__icon">✅</div>
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="about-section__card-stack">
            {ABOUT_CARDS.map(({ icon, title, desc }) => (
              <div className="about-card" key={title}>
                <div className="about-card__icon">{icon}</div>
                <div>
                  <h3 className="about-card__title">{title}</h3>
                  <p className="about-card__desc">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="how-it-works" aria-labelledby="how-heading">
        <div className="container">
          <h2 className="section-title" id="how-heading">How It Works</h2>
          <p className="section-subtitle">
            Three simple steps to get surplus food from a donor's door to
            someone who needs it.
          </p>
          <div className="how-it-works__steps">
            {STEPS.map(({ number, icon, title, desc }) => (
              <div className="step-card" key={number}>
                <div className="step-card__number">{number}</div>
                <div className="step-card__icon">{icon}</div>
                <h3 className="step-card__title">{title}</h3>
                <p className="step-card__desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Impact Statistics ── */}
      <section className="impact-section" aria-labelledby="impact-heading">
        <div className="container">
          <h2 className="section-title" id="impact-heading">Our Impact So Far</h2>
          <p className="section-subtitle">
            These numbers are placeholders — they'll be powered by live data
            once FoodBridge goes live.
          </p>
          <div className="impact-section__grid">
            {IMPACT_STATS.map(({ icon, number, label, sub }) => (
              <div className="impact-card" key={label}>
                <div className="impact-card__icon">{icon}</div>
                <div className="impact-card__number">{number}</div>
                <div className="impact-card__label">{label}</div>
                <div className="impact-card__sublabel">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="cta-section" aria-labelledby="cta-heading">
        <div className="container cta-section__inner">
          <h2 className="cta-section__title" id="cta-heading">
            Ready to Make a Difference?
          </h2>
          <p className="cta-section__subtitle">
            Join hundreds of donors, volunteers, and NGOs already on FoodBridge.
          </p>
          <div className="cta-section__actions">
            <Link to="/register" id="cta-banner-donate" className="btn btn-accent btn-lg">
              🍱 Start Donating
            </Link>
            <Link to="/register" id="cta-banner-volunteer" className="btn btn-outline-white btn-lg">
              🙋 Volunteer Now
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
