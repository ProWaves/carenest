// ==========================================================================
// Toast.jsx — Toast Notification System
// ==========================================================================
// Provides a context-based toast notification system for the entire app.
// ToastProvider wraps the app and manages a list of toasts with auto-dismiss.
// useToast() returns { addToast } — call addToast(msg, type, duration).
// Types: 'info' (default), 'success', 'error'. Duration defaults to 4s.
// ==========================================================================

import { createContext, useContext, useState, useCallback } from 'react';
import { playNotificationSound } from '../utils/sounds';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (type === 'success') playNotificationSound();
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.message}</span>
            <button className="toast-close" onClick={() => removeToast(t.id)}>&times;</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
