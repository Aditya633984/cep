import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import ProtectedRoute   from './components/ProtectedRoute';

import Navbar   from './components/Navbar';
import Footer   from './components/Footer';

import Home              from './pages/Home';
import About             from './pages/About';
import Contact           from './pages/Contact';
import Login             from './pages/Login';
import Register          from './pages/Register';
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
            {/* ── Public Routes ──────────────────────────────────── */}
            <Route path="/"             element={<Home />}        />
            <Route path="/about"        element={<About />}       />
            <Route path="/contact"      element={<Contact />}     />
            <Route path="/login"        element={<Login />}       />
            <Route path="/register"     element={<Register />}    />
            <Route path="/verify-email" element={<Navigate to="/login" replace />} />

            {/* ── Protected Dashboard Routes ─────────────────────── */}
            <Route
              path="/donor/dashboard"
              element={
                <ProtectedRoute role="donor">
                  <DonorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ngo/dashboard"
              element={
                <ProtectedRoute role="ngo">
                  <NgoDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/volunteer/dashboard"
              element={
                <ProtectedRoute role="volunteer">
                  <VolunteerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute role="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* ── 404 ────────────────────────────────────────────── */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppShell>
      </Router>
    </AuthProvider>
  );
}
