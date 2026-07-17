// client/src/components/Sidebar.jsx
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

function Sidebar() {
  const { user, logout } = useAuth();
  const { t, lang, changeLanguage } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname.startsWith('/dashboard/');
    }
    if (path === '/jobs') {
      return location.pathname === '/jobs' || location.pathname.startsWith('/jobs/');
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Navigation items based on user role
  const getNavItems = () => {
    const items = [];

    // Home - always show
    items.push({
      path: '/',
      icon: '🏠',
      label: 'Home',
      show: true,
    });

    // Role-based "Find" link
    if (user?.role === 'babysitter') {
      items.push({
        path: '/jobs',
        icon: '🔍',
        label: 'Find Jobs',
        show: true,
      });
    } else {
      items.push({
        path: '/babysitters',
        icon: '🔍',
        label: user?.role === 'parent' ? 'Find Babysitters' : 'Find Babysitters',
        show: true,
      });
    }

    if (user) {
      // Dashboard
      items.push({
        path: '/dashboard',
        icon: '📊',
        label: user.role === 'admin' ? 'Admin' : t('nav.dashboard'),
        show: true,
      });

      // Parent: My Jobs
      if (user.role === 'parent') {
        items.push({
          path: '/jobs/parent',
          icon: '📝',
          label: 'My Jobs',
          show: true,
        });
        items.push({
          path: '/jobs/post',
          icon: '📢',
          label: 'Post a Job',
          show: true,
        });
      }

      // Babysitter: My Applications
      if (user.role === 'babysitter') {
        items.push({
          path: '/jobs/applications',
          icon: '📋',
          label: 'My Applications',
          show: true,
        });
      }

      // Messages & Profile
      if (user.role === 'parent' || user.role === 'babysitter') {
        items.push({
          path: '/messages',
          icon: '💬',
          label: t('nav.messages'),
          show: true,
        });
        items.push({
          path: '/profile',
          icon: '👤',
          label: t('nav.profile'),
          show: true,
        });
      }
    }

    return items;
  };

  const navItems = getNavItems();

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <Link to="/">
          <span className="logo-icon">◈</span>
          <span className="logo-text">SitterSpot</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          item.show && (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${isActive(item.path) ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              <span className="sidebar-link-label">{item.label}</span>
            </Link>
          )
        ))}
      </nav>

      {/* Bottom section */}
      <div className="sidebar-bottom">
        {/* Language Switcher */}
        <div className="sidebar-lang">
          <button
            className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
            onClick={() => changeLanguage('en')}
          >
            EN
          </button>
          <button
            className={`lang-btn ${lang === 'fr' ? 'active' : ''}`}
            onClick={() => changeLanguage('fr')}
          >
            FR
          </button>
        </div>

        {/* User section */}
        {user ? (
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {user.first_name?.[0]}{user.last_name?.[0]}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">
                {user.first_name} {user.last_name}
              </span>
              <span className="sidebar-user-role">{user.role}</span>
            </div>
            <button onClick={handleLogout} className="sidebar-logout-btn" title="Logout">
              🚪
            </button>
          </div>
        ) : (
          <div className="sidebar-auth">
            <Link to="/login" className="sidebar-auth-btn login">
              {t('nav.login')}
            </Link>
            <Link to="/register" className="sidebar-auth-btn register">
              {t('nav.register')}
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;