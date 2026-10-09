import { Link } from 'react-router-dom';
import '../styles/About.css';

const VALUES = [
  { icon: '💚', title: 'Compassion',   desc: 'We believe every person deserves access to nutritious food, and we act on that belief every day.' },
  { icon: '🔍', title: 'Transparency', desc: 'Donors can track where their food goes. We maintain open records and clear reporting for all.' },
  { icon: '⚡', title: 'Efficiency',   desc: 'Technology helps us match donors with recipients quickly, minimising spoilage and maximising impact.' },
  { icon: '🌱', title: 'Sustainability', desc: 'By reducing food waste, FoodBridge contributes to a healthier planet alongside healthier communities.' },
  { icon: '🤝', title: 'Community',    desc: 'We foster trust between donors, volunteers, and NGOs to build lasting relationships that create change.' },
  { icon: '🔒', title: 'Safety',       desc: 'Strict food safety guidelines and verified networks ensure that all redistributed food is safe to eat.' },
];

const ROLES = [
  { icon: '🍱', title: 'Donors',     desc: 'Restaurants, homes, and businesses with surplus food.' },
  { icon: '🏢', title: 'NGOs',       desc: 'Registered organisations that receive and distribute food.' },
  { icon: '🚗', title: 'Volunteers', desc: 'Individuals who collect and deliver donations.' },
  { icon: '🛡️', title: 'Admins',     desc: 'Platform managers who verify accounts and monitor activity.' },
];

export default function About() {
  return (
    <main id="main-content" className="about-page">

      {/* Page Header */}
      <header className="page-header">
        <div className="container">
          <p className="page-header__label">About FoodBridge</p>
          <h1 className="page-header__title">Our Mission &amp; Story</h1>
          <p className="page-header__subtitle">
            We built FoodBridge to solve a problem that shouldn't exist — food going
            to waste while people go hungry. Here's why we do what we do.
          </p>
        </div>
      </header>

      {/* Mission */}
      <section className="about-mission" aria-labelledby="mission-heading">
        <div className="container about-mission__inner">
          <div>
            <p className="about-mission__label">Our Mission</p>
            <h2 className="about-mission__title" id="mission-heading">
              Zero Food Waste.<br />Zero Hunger.
            </h2>
            <p className="about-mission__body">
              FoodBridge was founded on the belief that no edible food should go to
              waste when there are people who need it. We are a community-driven
              platform that leverages technology to connect food donors — restaurants,
              households, and businesses — with NGOs and volunteers who can get that
              food to people facing hunger.
            </p>
            <p className="about-mission__body">
              Our platform streamlines the entire donation process: from listing
              surplus food to coordinating pickup and delivery, all in real time.
              We provide transparency, accountability, and measurable impact for
              everyone involved.
            </p>
            <Link to="/register" className="btn btn-primary">
              Join FoodBridge Today
            </Link>
          </div>
          <div className="about-mission__visual">
            <div className="about-mission__visual-icon">🌉</div>
            <h3 className="about-mission__visual-title">Building Bridges</h3>
            <p className="about-mission__visual-text">
              Between surplus food and the people who need it most — across
              communities, cities, and borders.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="about-values" aria-labelledby="values-heading">
        <div className="container">
          <h2 className="section-title" id="values-heading">What We Stand For</h2>
          <p className="section-subtitle">
            Six core values guide everything we do at FoodBridge.
          </p>
          <div className="about-values__grid">
            {VALUES.map(({ icon, title, desc }) => (
              <div className="value-card" key={title}>
                <div className="value-card__icon">{icon}</div>
                <h3 className="value-card__title">{title}</h3>
                <p className="value-card__desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="about-roles" aria-labelledby="roles-heading">
        <div className="container">
          <h2 className="section-title" id="roles-heading">Who Uses FoodBridge</h2>
          <p className="section-subtitle">
            FoodBridge serves four distinct user groups, each with their own
            dedicated dashboard and tools.
          </p>
          <div className="about-roles__grid">
            {ROLES.map(({ icon, title, desc }) => (
              <div className="role-card" key={title}>
                <div className="role-card__icon">{icon}</div>
                <h3 className="role-card__title">{title}</h3>
                <p className="role-card__desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </main>
  );
}
