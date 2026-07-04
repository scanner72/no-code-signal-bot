import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSignalsWs = (onNewSignal: (signal: any) => void) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3000`;
    // Remove /api if present for socket.io connection
    const socketUrl = API_URL.replace('/api', '') + '/signals';
    
    const socket = io(socketUrl, {
      transports: ['websocket'],
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to Signals Gateway');
    });

    socket.on('NEW_SIGNAL', (signal) => {
      console.log('New signal received:', signal);
      onNewSignal(signal);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [onNewSignal]);

  return socketRef.current;
};
