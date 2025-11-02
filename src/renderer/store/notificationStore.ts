import { create } from 'zustand';
import { NotificationOptions } from '@types/index';

interface Notification extends NotificationOptions {
  id: string;
}

interface NotificationStore {
  notifications: Notification[];

  // Actions
  addNotification: (options: NotificationOptions) => string;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],

  addNotification: (options) => {
    const id = options.id || generateId();
    const notification: Notification = {
      ...options,
      id,
      duration: options.duration ?? 5000,
    };

    set((state) => ({
      notifications: [...state.notifications, notification],
    }));

    // Auto-remove after duration
    if (notification.duration > 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      }, notification.duration);
    }

    return id;
  },

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  clearAllNotifications: () => set({ notifications: [] }),
}));

function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
