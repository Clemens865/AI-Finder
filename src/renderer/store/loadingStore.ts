import { create } from 'zustand';
import { LoadingState } from '@types/index';

interface LoadingStore extends LoadingState {
  // Actions
  setLoading: (loading: boolean, message?: string) => void;
  setProgress: (progress: number) => void;
  resetLoading: () => void;
}

export const useLoadingStore = create<LoadingStore>((set) => ({
  isLoading: false,
  message: undefined,
  progress: undefined,

  setLoading: (loading, message) =>
    set({
      isLoading: loading,
      message: message || undefined,
    }),

  setProgress: (progress) => set({ progress }),

  resetLoading: () =>
    set({
      isLoading: false,
      message: undefined,
      progress: undefined,
    }),
}));
