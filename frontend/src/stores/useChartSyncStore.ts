import { create } from 'zustand';

export interface ChartLevel {
  id: string; // matches the nodeId on the ReactFlow canvas
  label: string;
  price: number;
  color: string;
}

interface ChartSyncState {
  activeLevels: Record<string, ChartLevel>;
  registerLevel: (nodeId: string, level: ChartLevel) => void;
  unregisterLevel: (nodeId: string) => void;
  updateLevelPrice: (nodeId: string, price: number) => void;
  onLevelDragEnd: (nodeId: string, price: number) => void;
  addLevelFromChart: (price: number) => void;
}

export const useChartSyncStore = create<ChartSyncState>((set) => ({
  activeLevels: {},
  registerLevel: (nodeId, level) =>
    set((state) => ({
      activeLevels: { ...state.activeLevels, [nodeId]: level },
    })),
  unregisterLevel: (nodeId) =>
    set((state) => {
      const next = { ...state.activeLevels };
      delete next[nodeId];
      return { activeLevels: next };
    }),
  updateLevelPrice: (nodeId, price) =>
    set((state) => {
      if (!state.activeLevels[nodeId]) return state;
      return {
        activeLevels: {
          ...state.activeLevels,
          [nodeId]: { ...state.activeLevels[nodeId], price },
        },
      };
    }),
  onLevelDragEnd: (nodeId, price) => {
    const reactFlowInstance = (window as any).reactFlowInstance;
    if (reactFlowInstance) {
      reactFlowInstance.setNodes((nodes: any[]) =>
        nodes.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                value: price,
                bValue: price,
                params: {
                  ...(node.data?.params || {}),
                  price,
                },
              },
            };
          }
          return node;
        })
      );
    }
  },
  addLevelFromChart: (price) => {
    const reactFlowInstance = (window as any).reactFlowInstance;
    if (reactFlowInstance) {
      const id = 'user_level_' + Date.now();
      const newLevelId = Math.floor(Math.random() * 1000) + 1;
      const newNode = {
        id,
        type: 'user_level',
        position: { x: 150 + Math.random() * 100, y: 150 + Math.random() * 100 },
        data: {
          name: `Level ${price.toFixed(2)}`,
          color: '#6366f1',
          params: {
            price,
            levelId: newLevelId,
          },
        },
      };
      reactFlowInstance.setNodes((nodes: any[]) => [...nodes, newNode]);
    }
  },
}));
