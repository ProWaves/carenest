// client/src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const saved = localStorage.getItem('user');
    if (token && saved) {
      // Seed with cached user so UI renders immediately
      try {
        setUser(JSON.parse(saved));
      } catch {
        setUser(null);
      }
      API.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Then refresh from the server and MERGE (never replace) so any
      // extra fields (avatar_url, wallet, etc.) survive the round-trip.
      API.get('/auth/me')
        .then((res) => {
          setUser((prev) => {
            const merged = { ...(prev || {}), ...res.data };
            localStorage.setItem('user', JSON.stringify(merged));
            return merged;
          });
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          delete API.defaults.headers.common['Authorization'];
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    try {
      const res = await API.post('/auth/login', { email, password });
      const { token, user } = res.data;

      if (
        user.blocked ||
        user.error === 'account_suspended' ||
        user.error === 'account_deactivated'
      ) {
        return { blocked: true, ...user };
      }

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      API.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // MERGE into any pre-existing user object
      setUser((prev) => ({ ...(prev || {}), ...user }));
      return { user };
    } catch (error) {
      if (error.response?.data?.blocked) {
        return { blocked: true, ...error.response.data };
      }
      throw error;
    }
  };

  const register = async (data) => {
    const res = await API.post('/auth/register', data);
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    API.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    setUser((prev) => ({ ...(prev || {}), ...res.data.user }));
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete API.defaults.headers.common['Authorization'];
    setUser(null);
  };

  /**
   * Public helper for pages/components that need to update a piece of the
   * user (e.g. ProfilePage after a successful avatar upload).
   * Merges instead of replacing, and syncs localStorage.
   */
  const patchUser = (patch) => {
    setUser((prev) => {
      const merged = { ...(prev || {}), ...patch };
      localStorage.setItem('user', JSON.stringify(merged));
      return merged;
    });
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, setUser, patchUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);