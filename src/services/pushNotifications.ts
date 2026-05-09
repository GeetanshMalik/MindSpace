import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const DEFAULT_NOTIFICATION_CHANNEL_ID = 'messages';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(DEFAULT_NOTIFICATION_CHANNEL_ID, {
      name: 'Messages and reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#446C5E',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return null;
    }

    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      if (!projectId) {
        console.warn('Project ID not found in app config for push notifications');
        return null;
      }
      const extra = Constants.expoConfig?.extra as
        | { pushNotifications?: { androidGoogleServicesFilePresent?: boolean } }
        | undefined;
      if (
        Platform.OS === 'android' &&
        Constants.appOwnership !== 'expo' &&
        extra?.pushNotifications?.androidGoogleServicesFilePresent === false
      ) {
        console.warn(
          'google-services.json is not present in this build. If Android push notifications do not arrive, add Firebase/FCM credentials to EAS or include google-services.json.'
        );
      }
      token = (await Notifications.getExpoPushTokenAsync({
        projectId,
      })).data;
    } catch (e) {
      console.warn('Error fetching Expo Push Token:', e);
    }
  } else {
    console.warn('Must use physical device for Push Notifications');
  }

  return token;
}

export async function sendPushNotification(expoPushToken: string, title: string, body: string, data: any = {}) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data: {
      ...data,
      channelId: data?.channelId || DEFAULT_NOTIFICATION_CHANNEL_ID,
    },
    channelId: data?.channelId || DEFAULT_NOTIFICATION_CHANNEL_ID,
    priority: 'high',
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    if (!response.ok) {
      console.warn('Expo push notification request failed:', response.status, await response.text());
    }
  } catch (error) {
    console.warn('Error sending push notification:', error);
  }
}
