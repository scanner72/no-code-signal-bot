import { create } from 'zustand';

interface UiState {
  pineModalOpen: boolean;
  templatesOpen: boolean;
  backtestOpen: boolean;
  pineCode: string;
  
  setPineModalOpen: (open: boolean) => void;
  setTemplatesOpen: (open: boolean) => void;
  setBacktestOpen: (open: boolean) => void;
  setPineCode: (code: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  pineModalOpen: false,
  templatesOpen: false,
  backtestOpen: false,
  pineCode: '',

  setPineModalOpen: (open) => set({ pineModalOpen: open }),
  setTemplatesOpen: (open) => set({ templatesOpen: open }),
  setBacktestOpen: (open) => set({ backtestOpen: open }),
  setPineCode: (code) => set({ pineCode: code }),
}));
