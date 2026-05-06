import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiFetch } from './api';

/**
 * Ask for permission, fetch the Expo push token, register it with
 * the web API. Idempotent — calling twice does no harm.
 */
export async function registerForPush(): Promise<void> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== 'granted') {
    const r = await Notifications.requestPermissionsAsync();
    status = r.status;
  }
  if (status !== 'granted') return;

  const token = await Notifications.getExpoPushTokenAsync();
  await apiFetch('/api/devices/register', {
    method: 'POST',
    body: JSON.stringify({
      expoPushToken: token.data,
      platform: Platform.OS === 'android' ? 'android' : 'ios',
    }),
  }).catch(() => { /* best-effort */ });
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
