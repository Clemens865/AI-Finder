import { useNotificationStore } from '@store/notificationStore';
import { NotificationToast } from './NotificationToast';

export const NotificationContainer = () => {
  const { notifications } = useNotificationStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map((notification) => (
        <NotificationToast key={notification.id} notification={notification} />
      ))}
    </div>
  );
};
