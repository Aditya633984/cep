import { Link, useNavigate } from 'react-router-dom';
import '../styles/NotFound.css';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <main id="main-content" className="notfound-page">
      <div className="notfound-content">
        <div className="notfound-illustration" aria-hidden="true">🌉</div>
        <div className="notfound-code" aria-label="Error 404">404</div>
        <h1 className="notfound-title">Page Not Found</h1>
        <p className="notfound-desc">
          Oops! The page you're looking for doesn't exist or may have been
          moved. Let's get you back on track.
        </p>
        <div className="notfound-actions">
          <Link to="/" id="notfound-home" className="btn btn-primary btn-lg">
            ← Back to Home
          </Link>
          <button
            id="notfound-back"
            className="btn btn-outline btn-lg"
            onClick={() => navigate(-1)}
          >
            Go Back
          </button>
        </div>
      </div>
    </main>
  );
}
