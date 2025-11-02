import { create } from 'zustand';
import { MatchResult } from '@types/index';

interface MatchStore {
  matches: MatchResult[];
  selectedMatch: MatchResult | null;
  isSearching: boolean;
  searchProgress: number;

  // Actions
  setMatches: (matches: MatchResult[]) => void;
  addMatch: (match: MatchResult) => void;
  selectMatch: (match: MatchResult | null) => void;
  clearMatches: () => void;
  setIsSearching: (searching: boolean) => void;
  setSearchProgress: (progress: number) => void;
  sortMatches: (by: 'score' | 'file' | 'matches') => void;
}

export const useMatchStore = create<MatchStore>((set) => ({
  matches: [],
  selectedMatch: null,
  isSearching: false,
  searchProgress: 0,

  setMatches: (matches) => set({ matches }),

  addMatch: (match) =>
    set((state) => ({
      matches: [...state.matches, match],
    })),

  selectMatch: (match) => set({ selectedMatch: match }),

  clearMatches: () =>
    set({
      matches: [],
      selectedMatch: null,
      searchProgress: 0,
    }),

  setIsSearching: (searching) => set({ isSearching: searching }),

  setSearchProgress: (progress) => set({ searchProgress: progress }),

  sortMatches: (by) =>
    set((state) => {
      const sorted = [...state.matches].sort((a, b) => {
        switch (by) {
          case 'score':
            return b.totalScore - a.totalScore;
          case 'file':
            return a.file.localeCompare(b.file);
          case 'matches':
            return b.matches.length - a.matches.length;
          default:
            return 0;
        }
      });
      return { matches: sorted };
    }),
}));
