// client/src/components/Navbar.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useSocket } from '../context/SocketContext';
import { playNotificationSound } from '../utils/sounds';
import API from '../api/axios';
import Avatar from './Avatar';

function Navbar() {
  const { user, logout } = useAuth();
  const { t, lang, changeLanguage } = useLanguage();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notifRef = useRef(null);

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.is_read).length,
    [notifications]
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    const loadNotifs = () => {
      API.get('/notifications')
        .then((r) => {
          if (cancelled) return;
          const list = r.data?.notifications ?? [];
          console.log('🔔 [Navbar] Notifications fetched:', { count: list.length });
          setNotifications(list);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error('🔔 [Navbar] Notification fetch failed:', err?.response?.status, err?.response?.data || err.message);
        });
    };

    loadNotifs();
    return () => { cancelled = true; };
  }, [user?.id, location.pathname]);

  useEffect(() => {
    if (!socket) return;

    const handleNotif = (notif) => {
      setNotifications((prev) => {
        if (prev.some(n => n.id === notif.id)) return prev;
        playNotificationSound();
        return [notif, ...prev];
      });
    };

    socket.on('notification:new', handleNotif);
    return () => socket.off('notification:new', handleNotif);
  }, [socket]);

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const readNotif = async (id) => {
    try {
      await API.put(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {}
  };

  const readAll = async () => {
    try {
      await API.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {}
  };

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname.startsWith('/dashboard/');
    }
    if (path === '/jobs') {
      return location.pathname === '/jobs' || location.pathname.startsWith('/jobs/');
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo" onClick={() => setMobileOpen(false)}>
          <img
    src="/logo1.webp"
    alt="SitterSpot"
    className="logo-img"
    width={45}
      height={45}
  />
          SitterSpot
        </Link>

        <div className="nav-links">
          {user?.role === 'babysitter' ? (
            <Link to="/jobs" className={`nav-link ${isActive('/jobs') ? 'active' : ''}`}>
              🔍 Find Jobs
            </Link>
          ) : (
            <Link to="/babysitters" className={`nav-link ${isActive('/babysitters') ? 'active' : ''}`}>
              {t('nav.find')}
            </Link>
          )}

          {user ? (
            <>
              <Link to="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>
                {user.role === 'admin' ? '🛡️ Admin' : user.role === 'parent' ? '📋 Dashboard' : '👶 Dashboard'}
              </Link>

              {user.role === 'parent' && (
                <Link to="/jobs/post" className={`nav-link ${isActive('/jobs/post') ? 'active' : ''}`}>
                  📝 Post a Job
                </Link>
              )}

              {user.role === 'parent' && (
                <Link to="/jobs/parent" className={`nav-link ${isActive('/jobs/parent') ? 'active' : ''}`}>
                  📋 My Jobs
                </Link>
              )}

              {user.role === 'babysitter' && (
                <Link to="/jobs/applications" className={`nav-link ${isActive('/jobs/applications') ? 'active' : ''}`}>
                  📋 My Applications
                </Link>
              )}

              {(user.role === 'parent' || user.role === 'babysitter') && (
                <Link to="/messages" className={`nav-link ${isActive('/messages') ? 'active' : ''}`}>
                  {t('nav.messages')}
                </Link>
              )}

              {(user.role === 'parent' || user.role === 'babysitter') && (
                <Link to="/profile" className={`nav-link ${isActive('/profile') ? 'active' : ''}`}>
                  {t('nav.profile')}
                </Link>
              )}

              <div style={{ position: 'relative' }} ref={notifRef}>
                <button className="notif-bell" onClick={() => setNotifOpen(!notifOpen)}>
                  {String.fromCodePoint(128276)}
                  {unreadCount > 0 && <span className="notif-dot" />}
                </button>
                {notifOpen && (
                  <div className="notif-panel">
                    <div className="notif-panel-header">
                      <span>Notifications</span>
                      {unreadCount > 0 && (
                        <button onClick={readAll} className="btn btn-sm btn-ghost" style={{ fontSize: '0.8rem' }}>
                          Mark all read
                        </button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div className="no-conv">No notifications</div>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`} onClick={() => readNotif(n.id)}>
                          <div className="notif-title">{n.title}</div>
                          {n.message && <div className="notif-message">{n.message}</div>}
                          <div className="notif-time">{new Date(n.created_at).toLocaleDateString()}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <button onClick={handleLogout} className="nav-link btn-link">{t('nav.logout')}</button>

              <div className="nav-user">
                <Avatar user={user} size={30} />
                <span>{user.first_name}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
                  ({user.role})
                </span>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className={`nav-link ${isActive('/login') ? 'active' : ''}`}>
                {t('nav.login')}
              </Link>
              <Link to="/register" className="nav-link nav-register">
                {t('nav.register')}
              </Link>
            </>
          )}

          <button onClick={toggleTheme} className="theme-toggle" title={theme === 'light' ? 'Dark mode' : 'Light mode'}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          <div className="lang-switch">
            <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => changeLanguage('en')}>EN</button>
            <button className={`lang-btn ${lang === 'fr' ? 'active' : ''}`} onClick={() => changeLanguage('fr')}>FR</button>
          </div>

          <button className="mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? String.fromCodePoint(10005) : String.fromCodePoint(9776)}
          </button>
        </div>
      </div>

      <div className={`mobile-menu ${mobileOpen ? 'open' : ''}`}>
        {user?.role === 'babysitter' ? (
          <Link to="/jobs" className="nav-link" onClick={() => setMobileOpen(false)}>
            🔍 Find Jobs
          </Link>
        ) : (
          <Link to="/babysitters" className="nav-link" onClick={() => setMobileOpen(false)}>
            {t('nav.find')}
          </Link>
        )}

        {user ? (
          <>
            <Link to="/dashboard" className="nav-link" onClick={() => setMobileOpen(false)}>
              {user.role === 'admin' ? '🛡️ Admin' : user.role === 'parent' ? '📋 Dashboard' : '👶 Dashboard'}
            </Link>

            {user.role === 'parent' && (
              <Link to="/jobs/post" className="nav-link" onClick={() => setMobileOpen(false)}>
                📝 Post a Job
              </Link>
            )}

            {user.role === 'parent' && (
              <Link to="/jobs/parent" className="nav-link" onClick={() => setMobileOpen(false)}>
                📋 My Jobs
              </Link>
            )}

            {user.role === 'babysitter' && (
              <Link to="/jobs/applications" className="nav-link" onClick={() => setMobileOpen(false)}>
                📋 My Applications
              </Link>
            )}

            {(user.role === 'parent' || user.role === 'babysitter') && (
              <>
                <Link to="/messages" className="nav-link" onClick={() => setMobileOpen(false)}>
                  {t('nav.messages')}
                </Link>
                <Link to="/profile" className="nav-link" onClick={() => setMobileOpen(false)}>
                  {t('nav.profile')}
                </Link>
              </>
            )}

            <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="nav-link btn-link">
              {t('nav.logout')}
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="nav-link" onClick={() => setMobileOpen(false)}>
              {t('nav.login')}
            </Link>
            <Link to="/register" className="nav-link" onClick={() => setMobileOpen(false)}>
              {t('nav.register')}
            </Link>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, padding: '8px 16px', alignItems: 'center', borderTop: '1px solid var(--color-border-light)', marginTop: 8 }}>
          <button onClick={toggleTheme} className="theme-toggle">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <div className="lang-switch">
            <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => { changeLanguage('en'); setMobileOpen(false); }}>
              EN
            </button>
            <button className={`lang-btn ${lang === 'fr' ? 'active' : ''}`} onClick={() => { changeLanguage('fr'); setMobileOpen(false); }}>
              FR
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;