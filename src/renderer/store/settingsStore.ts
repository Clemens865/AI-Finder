import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings } from '@types/index';

interface SettingsStore extends AppSettings {
  // Actions
  updateSettings: (settings: Partial<AppSettings>) => void;
  setTheme: (theme: AppSettings['theme']) => void;
  setApiKey: (key: string) => void;
  toggleNotifications: () => void;
  addFileType: (type: string) => void;
  removeFileType: (type: string) => void;
  addExcludePattern: (pattern: string) => void;
  removeExcludePattern: (pattern: string) => void;
  resetSettings: () => void;
  initializeSettings: () => void;
}

const defaultSettings: AppSettings = {
  theme: 'auto',
  maxResults: 100,
  searchDepth: 5,
  fileTypes: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h'],
  excludePatterns: ['node_modules', 'dist', 'build', '.git', '.next', 'coverage'],
  notifications: {
    enabled: true,
    sound: false,
  },
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,

      updateSettings: (settings) => set(settings),

      setTheme: (theme) => set({ theme }),

      setApiKey: (apiKey) => set({ apiKey }),

      toggleNotifications: () =>
        set((state) => ({
          notifications: {
            ...state.notifications,
            enabled: !state.notifications.enabled,
          },
        })),

      addFileType: (type) =>
        set((state) => ({
          fileTypes: [...state.fileTypes, type],
        })),

      removeFileType: (type) =>
        set((state) => ({
          fileTypes: state.fileTypes.filter((t) => t !== type),
        })),

      addExcludePattern: (pattern) =>
        set((state) => ({
          excludePatterns: [...state.excludePatterns, pattern],
        })),

      removeExcludePattern: (pattern) =>
        set((state) => ({
          excludePatterns: state.excludePatterns.filter((p) => p !== pattern),
        })),

      resetSettings: () => set(defaultSettings),

      initializeSettings: () => {
        // Load from localStorage if available
        const stored = localStorage.getItem('intelligent-finder-settings');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            set(parsed);
          } catch (error) {
            console.error('Failed to parse stored settings:', error);
          }
        }
      },
    }),
    {
      name: 'intelligent-finder-settings',
    }
  )
);
