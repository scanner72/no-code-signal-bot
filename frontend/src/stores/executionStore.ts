import { create } from 'zustand';

interface BacktestForm {
  start: string;
  end: string;
  initialBalance: number;
  feePercent: number;
  tpPercent: number;
  slPercent: number;
  positionSizePercent: number;
  slippagePct: number;
  latencyMs: number;
  executionAlgo: 'MARKET' | 'TWAP' | 'VWAP';
  useTrailingStop: boolean;
  trailingDistance: number;
  trailingActivation: number;
}

interface ExecutionState {
  backtestForm: BacktestForm;
  backtestReq: { status: 'idle' | 'loading' | 'error' | 'success'; result?: any; error?: string };
  
  setBacktestForm: (updater: BacktestForm | ((prev: BacktestForm) => BacktestForm)) => void;
  setBacktestReq: (req: { status: 'idle' | 'loading' | 'error' | 'success'; result?: any; error?: string }) => void;
}

const today = new Date().toISOString().slice(0, 10);
const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const useExecutionStore = create<ExecutionState>((set) => ({
  backtestForm: {
    start: sixMonthsAgo,
    end: today,
    initialBalance: 1000,
    feePercent: 0.1,
    tpPercent: 2,
    slPercent: 1,
    positionSizePercent: 90,
    slippagePct: 0.1,
    latencyMs: 50,
    executionAlgo: 'MARKET',
    useTrailingStop: false,
    trailingDistance: 1,
    trailingActivation: 0.5,
  },
  backtestReq: { status: 'idle' },

  setBacktestForm: (updater) => set((state) => ({
    backtestForm: typeof updater === 'function' ? updater(state.backtestForm) : updater
  })),
  
  setBacktestReq: (req) => set({ backtestReq: req })
}));
