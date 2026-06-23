import { useEffect, useCallback } from 'react';

export const useNotifications = () => {
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const sendNotification = useCallback((title, options = {}) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/logo192.png', // Assuming default logo or update path
        ...options,
      });
    }
  }, []);

  return { sendNotification };
};
