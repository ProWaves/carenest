// client/src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useLanguage } from './context/LanguageContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Footer from './components/Footer';
import AIChatbot from './components/AIChatbot';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import FindBabysitters from './pages/FindBabysitters';
import BabysitterProfile from './pages/BabysitterProfile';
import ParentDashboard from './pages/ParentDashboard';
import BabysitterDashboard from './pages/BabysitterDashboard';
import AdminDashboard from './pages/AdminDashboard';
import BookingPage from './pages/BookingPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
// Job related imports
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import PostJob from './pages/PostJob';
import ParentJobs from './pages/ParentJobs';
import JobApplications from './pages/JobApplications';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

// ============================================
// LAYOUTS
// ============================================

// Layout for public/unauthenticated users - Navbar only
function PublicLayout({ children }) {
  return (
    <div className="app public-layout">
      <Navbar />
      <main className="main-content">{children}</main>
      <Footer />
      <AIChatbot />
    </div>
  );
}

// Layout for Parents - Navbar only (all pages)
function ParentLayout({ children }) {
  return (
    <div className="app public-layout">
      <Navbar />
      <main className="main-content" style={{ paddingTop: 'calc(var(--nav-height) + 32px)' }}>
        {children}
      </main>
      <Footer />
      <AIChatbot />
    </div>
  );
}

// Layout for Babysitters - Sidebar + Header (all pages)
function BabysitterLayout({ children }) {
  return (
    <div className="app dashboard-layout">
      <Sidebar />
      <div className="app-main">
        <Header />
        <main className="page-content">{children}</main>
        <Footer />
      </div>
    </div>
  );
}

// Layout for Admins - Sidebar + Header (all pages)
function AdminLayout({ children }) {
  return (
    <div className="app dashboard-layout">
      <Sidebar />
      <div className="app-main">
        <Header />
        <main className="page-content">{children}</main>
        <Footer />
      </div>
    </div>
  );
}

// Layout for Job pages - Babysitters use Sidebar+Header, Parents use Navbar
function JobLayout({ children }) {
  const { user } = useAuth();
  if (user?.role === 'babysitter') {
    return (
      <div className="app dashboard-layout">
        <Sidebar />
        <div className="app-main">
          <Header />
          <main className="page-content">{children}</main>
          <Footer />
        </div>
      </div>
    );
  }
  return (
    <div className="app public-layout">
      <Navbar />
      <main className="main-content" style={{ paddingTop: 'calc(var(--nav-height) + 32px)' }}>
        {children}
      </main>
      <Footer />
      <AIChatbot />
    </div>
  );
}

function App() {
  const { user, loading } = useAuth();
  const { lang } = useLanguage();

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div lang={lang}>
      <Routes>
        {/* ============================================
            PUBLIC ROUTES - Always use Navbar
            ============================================ */}
        <Route path="/" element={
          <PublicLayout>
            <Home />
          </PublicLayout>
        } />

        <Route path="/login" element={
          <PublicLayout>
            {user ? <Navigate to="/" /> : <Login />}
          </PublicLayout>
        } />

        <Route path="/register" element={
          <PublicLayout>
            {user ? <Navigate to="/" /> : <Register />}
          </PublicLayout>
        } />

        {/* ============================================
            BABYSITTERS - ROLE-BASED LAYOUT
            ============================================ */}
        
        {/* Find Babysitters - Role-based layout */}
        <Route path="/babysitters" element={
          !user ? (
            <PublicLayout><FindBabysitters /></PublicLayout>
          ) : user.role === 'parent' ? (
            <ParentLayout><FindBabysitters /></ParentLayout>
          ) : user.role === 'babysitter' ? (
            <BabysitterLayout><FindBabysitters /></BabysitterLayout>
          ) : user.role === 'admin' ? (
            <AdminLayout><FindBabysitters /></AdminLayout>
          ) : (
            <PublicLayout><FindBabysitters /></PublicLayout>
          )
        } />

        {/* Babysitter Profile - Role-based layout */}
        <Route path="/babysitters/:id" element={
          !user ? (
            <PublicLayout><BabysitterProfile /></PublicLayout>
          ) : user.role === 'parent' ? (
            <ParentLayout><BabysitterProfile /></ParentLayout>
          ) : user.role === 'babysitter' ? (
            <BabysitterLayout><BabysitterProfile /></BabysitterLayout>
          ) : user.role === 'admin' ? (
            <AdminLayout><BabysitterProfile /></AdminLayout>
          ) : (
            <PublicLayout><BabysitterProfile /></PublicLayout>
          )
        } />

        {/* Booking Page - Only Parents can book */}
        <Route path="/babysitters/:id/book" element={
          <PublicLayout>
            <ProtectedRoute roles={['parent']}>
              <BookingPage />
            </ProtectedRoute>
          </PublicLayout>
        } />

        {/* ============================================
            DASHBOARD - ROLE-BASED
            ============================================ */}
        <Route path="/dashboard" element={
          <ProtectedRoute roles={['parent', 'babysitter', 'admin']}>
            {user?.role === 'parent' ? (
              <ParentLayout><ParentDashboard /></ParentLayout>
            ) : user?.role === 'babysitter' ? (
              <BabysitterLayout><BabysitterDashboard /></BabysitterLayout>
            ) : user?.role === 'admin' ? (
              <AdminLayout><AdminDashboard /></AdminLayout>
            ) : (
              <PublicLayout><Home /></PublicLayout>
            )}
          </ProtectedRoute>
        } />

        {/* ============================================
            MESSAGES - ROLE-BASED
            ============================================ */}
        <Route path="/messages" element={
          <ProtectedRoute roles={['parent', 'babysitter']}>
            {user?.role === 'parent' ? (
              <ParentLayout><ChatPage /></ParentLayout>
            ) : (
              <BabysitterLayout><ChatPage /></BabysitterLayout>
            )}
          </ProtectedRoute>
        } />

        <Route path="/messages/:userId" element={
          <ProtectedRoute roles={['parent', 'babysitter']}>
            {user?.role === 'parent' ? (
              <ParentLayout><ChatPage /></ParentLayout>
            ) : (
              <BabysitterLayout><ChatPage /></BabysitterLayout>
            )}
          </ProtectedRoute>
        } />

        {/* ============================================
            PROFILE - ROLE-BASED
            ============================================ */}
        <Route path="/profile" element={
          <ProtectedRoute roles={['parent', 'babysitter']}>
            {user?.role === 'parent' ? (
              <ParentLayout><ProfilePage /></ParentLayout>
            ) : (
              <BabysitterLayout><ProfilePage /></BabysitterLayout>
            )}
          </ProtectedRoute>
        } />

        {/* ============================================
            JOBS - ROLE-BASED
            ============================================ */}

        {/* Babysitter: Find Jobs */}
        <Route path="/jobs" element={
          <ProtectedRoute roles={['babysitter']}>
            <BabysitterLayout><Jobs /></BabysitterLayout>
          </ProtectedRoute>
        } />

        {/* Babysitter: Job Detail */}
        <Route path="/jobs/:id" element={
          <ProtectedRoute roles={['babysitter']}>
            <BabysitterLayout><JobDetail /></BabysitterLayout>
          </ProtectedRoute>
        } />

        {/* Babysitter: My Applications */}
        <Route path="/jobs/applications" element={
          <ProtectedRoute roles={['babysitter']}>
            <BabysitterLayout><JobApplications /></BabysitterLayout>
          </ProtectedRoute>
        } />

        {/* Parent: Post a Job */}
        <Route path="/jobs/post" element={
          <ProtectedRoute roles={['parent']}>
            <ParentLayout><PostJob /></ParentLayout>
          </ProtectedRoute>
        } />

        {/* Parent: My Jobs */}
        <Route path="/jobs/parent" element={
          <ProtectedRoute roles={['parent']}>
            <ParentLayout><ParentJobs /></ParentLayout>
          </ProtectedRoute>
        } />

        {/* ============================================
            404
            ============================================ */}
        <Route path="*" element={
          <PublicLayout>
            <div className="not-found">
              <h2>404</h2>
              <p>Page not found</p>
            </div>
          </PublicLayout>
        } />
      </Routes>
    </div>
  );
}

export default App;// Trigger deploy - Sat Jul 18 15:11:56 MEST 2026
