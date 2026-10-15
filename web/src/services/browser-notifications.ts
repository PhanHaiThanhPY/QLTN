import type { Notification as AppNotification } from '@/domain/types';

const ENABLED_KEY = 'qltn-browser-notifications-enabled';

export const browserNotificationsSupported = (): boolean => typeof window !== 'undefined' && 'Notification' in window;

export const browserNotificationPermission = (): NotificationPermission | 'unsupported' => {
  if (!browserNotificationsSupported()) return 'unsupported';
  return window.Notification.permission;
};

export const browserNotificationsEnabled = (): boolean => {
  if (!browserNotificationsSupported()) return false;
  return window.localStorage.getItem(ENABLED_KEY) === 'true' && window.Notification.permission === 'granted';
};

export const requestBrowserNotificationPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (!browserNotificationsSupported()) return 'unsupported';
  const permission = await window.Notification.requestPermission();
  if (permission === 'granted') window.localStorage.setItem(ENABLED_KEY, 'true');
  return permission;
};

/** Shows one new in-app notification as a native browser notification when the user opted in. */
export const notifyBrowser = (notification: AppNotification): void => {
  if (!browserNotificationsEnabled()) return;
  try {
    const instance = new window.Notification(notification.title, {
      body: notification.message,
      tag: notification.id,
    });
    instance.onclick = () => {
      window.focus();
      instance.close();
    };
  } catch (error) {
    console.error('Browser notification failed:', error);
  }
};
