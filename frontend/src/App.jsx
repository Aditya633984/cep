import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import ProtectedRoute   from './components/ProtectedRoute';

import Navbar   from './components/Navbar';
import Footer   from './components/Footer';

import Home              from './pages/Home';
import About             from './pages/About';
import Contact           from './pages/Contact';
import NotFound          from './pages/NotFound';
import DonorDashboard    from './pages/DonorDashboard';
import NgoDashboard      from './pages/NgoDashboard';
import VolunteerDashboard from './pages/VolunteerDashboard';
import AdminDashboard    from './pages/AdminDashboard';

import './styles/index.css';

// Hides Navbar/Footer on full-page dashboard routes (admin)
function AppShell({ children }) {
  const { pathname } = useLocation();
  const isAdminRoute = pathname.startsWith('/admin');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {!isAdminRoute && <Navbar />}
      {children}
      {!isAdminRoute && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppShell>
          <Routes>
            {/* ── Public & Informational Routes ──────────────────── */}
            <Route path="/"             element={<Home />}        />
            <Route path="/about"        element={<About />}       />
            <Route path="/contact"      element={<Contact />}     />

            {/* ── Direct Access Dashboard Portals ─────────────────── */}
            <Route path="/donor" element={<Navigate to="/donor/dashboard" replace />} />
            <Route
              path="/donor/dashboard"
              element={
                <ProtectedRoute>
                  <DonorDashboard />
                </ProtectedRoute>
              }
            />

            <Route path="/ngo" element={<Navigate to="/ngo/dashboard" replace />} />
            <Route
              path="/ngo/dashboard"
              element={
                <ProtectedRoute>
                  <NgoDashboard />
                </ProtectedRoute>
              }
            />

            <Route path="/volunteer" element={<Navigate to="/volunteer/dashboard" replace />} />
            <Route
              path="/volunteer/dashboard"
              element={
                <ProtectedRoute>
                  <VolunteerDashboard />
                </ProtectedRoute>
              }
            />

            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* ── Legacy Auth Routes: Open Direct Redirection ─────── */}
            <Route path="/login"        element={<Navigate to="/donor/dashboard" replace />} />
            <Route path="/register"     element={<Navigate to="/donor/dashboard" replace />} />
            <Route path="/verify-email" element={<Navigate to="/donor/dashboard" replace />} />

            {/* ── 404 ────────────────────────────────────────────── */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppShell>
      </Router>
    </AuthProvider>
  );
}
