import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.close();
        socketRef.current = null;
      }
      setSocket(null);
      setConnected(false);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    // Use Render backend URL for WebSocket
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://sitterspot-backend.onrender.com';

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
  }, [user?.id]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);