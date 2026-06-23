import { create } from 'zustand';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: Date;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'signal' | 'system' | 'error' | 'success';
  timestamp: Date;
  read: boolean;
}

interface NotificationState {
  toasts: ToastMessage[];
  notifications: NotificationItem[];
  
  // Toast actions
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  removeToast: (id: string) => void;
  
  // Notification center actions
  addNotification: (title: string, message: string, type?: 'signal' | 'system' | 'error' | 'success') => void;
  markAllAsRead: () => void;
  clearAllNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  toasts: [],
  notifications: [
    { id: '1', title: 'Система активна', message: 'Cyber-Quant Signal Bot запущен и готов к работе.', type: 'system', timestamp: new Date(Date.now() - 3600000), read: true },
    { id: '2', title: 'Успешное подключение', message: 'Связь с сервером WebSocket Binance установлена.', type: 'success', timestamp: new Date(Date.now() - 1800000), read: true }
  ],

  addToast: (message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = { id, message, type, timestamp: new Date() };
    
    set((state) => ({ toasts: [...state.toasts, newToast] }));
    
    // Auto-remove toast after 4 seconds
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  addNotification: (title, message, type = 'system') => {
    const id = Math.random().toString(36).substring(2, 9);
    const item: NotificationItem = { id, title, message, type, timestamp: new Date(), read: false };
    set((state) => ({ notifications: [item, ...state.notifications] }));
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true }))
    }));
  },

  clearAllNotifications: () => {
    set({ notifications: [] });
  }
}));

// Quick helper shortcuts
export const toast = {
  success: (msg: string) => useNotificationStore.getState().addToast(msg, 'success'),
  error: (msg: string) => useNotificationStore.getState().addToast(msg, 'error'),
  warning: (msg: string) => useNotificationStore.getState().addToast(msg, 'warning'),
  info: (msg: string) => useNotificationStore.getState().addToast(msg, 'info')
};
