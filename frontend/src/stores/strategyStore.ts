import { create } from 'zustand';
import { Node, Edge, OnNodesChange, OnEdgesChange, applyNodeChanges, applyEdgeChanges, addEdge, Connection, MarkerType } from 'reactflow';

// Re-implementing EDGE_COLORS lookup for connections
import { EDGE_COLORS } from '../blocks/registry';

interface StrategyState {
  nodes: Node[];
  edges: Edge[];
  strategyName: string;
  pair: string;
  timeframe: string;
  savedStrategyId: number | null;
  userLevels: number[];
  
  isActive: boolean;
  isPaperTrading: boolean;
  executionSettings: any;
  
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  updateNodeData: (nodeId: string, newData: any) => void;
  applyRemoteNodeChanges: (changes: any) => void;
  applyRemoteEdgeChanges: (changes: any) => void;
  
  setStrategyName: (name: string) => void;
  setPair: (pair: string) => void;
  setTimeframe: (timeframe: string) => void;
  setSavedStrategyId: (id: number | null) => void;
  setUserLevels: (levels: number[]) => void;
  setIsActive: (active: boolean) => void;
  setIsPaperTrading: (paper: boolean) => void;
  setExecutionSettings: (settings: any) => void;
  
  reset: (initialStrategy?: any) => void;
}

const initialNodes: Node[] = [
  {
    id: 'node_1',
    type: 'signal',
    position: { x: 600, y: 200 },
    data: { signalType: 'LONG' },
  },
];

export const useStrategyStore = create<StrategyState>((set, get) => ({
  nodes: initialNodes,
  edges: [],
  strategyName: 'Без названия',
  pair: 'BTCUSDT',
  timeframe: '1h',
  savedStrategyId: null,
  userLevels: [],
  isActive: false,
  isPaperTrading: true,
  executionSettings: { tpPercent: 2.0, slPercent: 1.0 },

  setNodes: (updater) => set((state) => ({
    nodes: typeof updater === 'function' ? updater(state.nodes) : updater
  })),

  setEdges: (updater) => set((state) => ({
    edges: typeof updater === 'function' ? updater(state.edges) : updater
  })),

  onNodesChange: (changes) => set({
    nodes: applyNodeChanges(changes, get().nodes),
  }),

  onEdgesChange: (changes) => set({
    edges: applyEdgeChanges(changes, get().edges),
  }),

  onConnect: (connection) => {
    const sourceNode = get().nodes.find((n) => n.id === connection.source);
    const color = EDGE_COLORS[sourceNode?.type || ''] || '#e0ddd6';
    
    set({
      edges: addEdge({
        ...connection,
        animated: true,
        style: { stroke: color, strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 4, height: 4 },
      }, get().edges)
    });
  },

  updateNodeData: (nodeId, newData) => {
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...newData } } : n))
    }));
  },

  applyRemoteNodeChanges: (changes) => set((state) => ({
    nodes: applyNodeChanges(changes, state.nodes),
  })),

  applyRemoteEdgeChanges: (changes) => set((state) => ({
    edges: applyEdgeChanges(changes, state.edges),
  })),

  setStrategyName: (name) => set({ strategyName: name }),
  setPair: (pair) => set({ pair }),
  setTimeframe: (timeframe) => set({ timeframe }),
  setSavedStrategyId: (id) => set({ savedStrategyId: id }),
  setUserLevels: (levels) => set({ userLevels: levels }),
  setIsActive: (active) => set({ isActive: active }),
  setIsPaperTrading: (paper) => set({ isPaperTrading: paper }),
  setExecutionSettings: (settings) => set({ executionSettings: settings }),

  reset: (initialStrategy) => set({
    nodes: initialStrategy?.nodes ?? initialNodes,
    edges: initialStrategy?.edges ?? [],
    strategyName: initialStrategy?.name ?? 'Без названия',
    pair: initialStrategy?.pair ?? 'BTCUSDT',
    timeframe: initialStrategy?.timeframe ?? '1h',
    savedStrategyId: initialStrategy?.id ?? null,
    isActive: initialStrategy?.is_active ?? false,
    isPaperTrading: initialStrategy?.is_paper_trading ?? true,
    executionSettings: initialStrategy?.execution_settings ?? { tpPercent: 2.0, slPercent: 1.0 },
  })
}));
