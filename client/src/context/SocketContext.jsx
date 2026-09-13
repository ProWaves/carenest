import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  // Track the token so we can reconnect when it rotates (e.g. after login
  // as a different user, or after a token refresh).
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  // Keep `token` in sync with localStorage. AuthContext writes to
  // localStorage on login/logout; we poll the value whenever the user
  // identity changes.
  useEffect(() => {
    const t = localStorage.getItem('token');
    setToken(t);
  }, [user?.id]);

  useEffect(() => {
    // No user OR no token → tear down any existing socket.
    if (!user || !token) {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.close();
        socketRef.current = null;
      }
      setSocket(null);
      setConnected(false);
      return;
    }

    // Use Render backend URL for WebSocket
    const SOCKET_URL =
      import.meta.env.VITE_SOCKET_URL || 'https://sitterspot-backend.onrender.com';

    const s = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    s.on('connect', () => {
      console.log('🔌 Socket connected to:', SOCKET_URL);
      setConnected(true);
    });
    s.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
      setConnected(false);
    });
    s.on('connect_error', (error) => {
      console.log('🔌 Socket connection error:', error.message);
    });

    socketRef.current = s;
    setSocket(s);

    return () => {
      s.removeAllListeners();
      s.close();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, [user?.id, token]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);