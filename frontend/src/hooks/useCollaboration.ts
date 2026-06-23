import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStrategyStore } from '../stores/strategyStore';

export const useCollaboration = (strategyId: string | null) => {
  const socketRef = useRef<Socket | null>(null);
  const { applyRemoteNodeChanges, applyRemoteEdgeChanges } = useStrategyStore();

  useEffect(() => {
    if (!strategyId) return;

    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000');
    socketRef.current = socket;

    socket.emit('join-strategy', { strategyId });

    socket.on('node-change', (changes) => {
      // Apply incoming changes strictly from remote
      applyRemoteNodeChanges(changes);
    });

    socket.on('edge-change', (changes) => {
      applyRemoteEdgeChanges(changes);
    });

    return () => {
      socket.emit('leave-strategy', { strategyId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [strategyId, applyRemoteNodeChanges, applyRemoteEdgeChanges]);

  const broadcastNodeChanges = (changes: any) => {
    if (socketRef.current && strategyId) {
      socketRef.current.emit('node-change', { strategyId, changes });
    }
  };

  const broadcastEdgeChanges = (changes: any) => {
    if (socketRef.current && strategyId) {
      socketRef.current.emit('edge-change', { strategyId, changes });
    }
  };

  return { broadcastNodeChanges, broadcastEdgeChanges };
};
