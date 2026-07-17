// client/src/components/Header.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useSocket } from '../context/SocketContext';
import { playNotificationSound } from '../utils/sounds';
import API from '../api/axios';

function Header() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { socket } = useSocket();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef(null);

  // ============================================
  // REAL-TIME CLOCK STATE
  // ============================================
  const [currentTime, setCurrentTime] = useState(new Date());

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format date and time
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  // Fetch notifications
  useEffect(() => {
    if (user) {
      API.get('/notifications')
        .then((r) => {
          setNotifications(r.data.notifications);
          setUnreadCount(r.data.unread);
        })
        .catch(() => {});
    }
  }, [user]);

  // Socket notifications
  useEffect(() => {
    if (!socket) return;

    const handleNotif = (notif) => {
      playNotificationSound();
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };

    socket.on('notification:new', handleNotif);
    return () => socket.off('notification:new', handleNotif);
  }, [socket]);

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const readNotif = async (id) => {
    try {
      await API.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  const readAll = async () => {
    try {
      await API.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  return (
    <header className="app-header">
      <div className="header-left">
        {/* Clock Display */}
        <div className="header-clock">
          <div className="header-clock-time">{formatTime(currentTime)}</div>
          <div className="header-clock-date">{formatDate(currentTime)}</div>
        </div>
      </div>

      <div className="header-right">
        {/* Theme Toggle */}
        <button onClick={toggleTheme} className="header-btn" title={theme === 'light' ? 'Dark mode' : 'Light mode'}>
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        {/* Notifications */}
        {user && (
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button
              className={`header-btn notif-btn ${unreadCount > 0 ? 'has-notif' : ''}`}
              onClick={() => setNotifOpen(!notifOpen)}
              title="Notifications"
            >
              🔔
              {unreadCount > 0 && <span className="notif-dot">{unreadCount}</span>}
            </button>

            {notifOpen && (
              <div className="notif-panel">
                <div className="notif-panel-header">
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <button onClick={readAll} className="btn btn-sm btn-ghost">
                      Mark all read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="no-conv">No notifications</div>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <div
                      key={n.id}
                      className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                      onClick={() => readNotif(n.id)}
                    >
                      <div className="notif-title">{n.title}</div>
                      {n.message && <div className="notif-message">{n.message}</div>}
                      <div className="notif-time">{new Date(n.created_at).toLocaleDateString()}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* User Avatar */}
        {user && (
          <div className="header-user">
            <div className="header-avatar">
              {user.first_name?.[0]}{user.last_name?.[0]}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;