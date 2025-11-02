import { useEffect } from 'react';
import { useNotificationStore } from '@store/notificationStore';
import { NotificationOptions } from '@types/index';
import { Card, Button } from '@components/UI';
import { X, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import clsx from 'clsx';

interface NotificationToastProps {
  notification: NotificationOptions & { id: string };
}

export const NotificationToast = ({ notification }: NotificationToastProps) => {
  const { removeNotification } = useNotificationStore();

  useEffect(() => {
    if (notification.duration && notification.duration > 0) {
      const timer = setTimeout(() => {
        removeNotification(notification.id);
      }, notification.duration);

      return () => clearTimeout(timer);
    }
  }, [notification.id, notification.duration, removeNotification]);

  const icons = {
    info: <Info className="w-5 h-5" />,
    success: <CheckCircle className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
  };

  const colors = {
    info: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    success: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    warning: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    error: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  };

  return (
    <Card
      padding="sm"
      className={clsx(
        'animate-slide-in shadow-lg min-w-[320px] max-w-md',
        colors[notification.type]
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          {icons[notification.type]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm mb-1">{notification.title}</h4>
          {notification.message && (
            <p className="text-sm opacity-90">{notification.message}</p>
          )}

          {/* Action Button */}
          {notification.action && (
            <Button
              size="sm"
              variant="ghost"
              onClick={notification.action.onClick}
              className="mt-2"
            >
              {notification.action.label}
            </Button>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={() => removeNotification(notification.id)}
          className="flex-shrink-0 p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </Card>
  );
};
