const fs = require('fs');
const path = require('path');

const TEST_ADMOB_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const TEST_ADMOB_IOS_APP_ID = 'ca-app-pub-3940256099942544~1458002511';

module.exports = ({ config }) => {
  const localGoogleServicesPath = path.join(__dirname, 'google-services.json');
  const hasLocalGoogleServices = fs.existsSync(localGoogleServicesPath);
  // EAS secret file env var takes priority, then local file
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ||
    (hasLocalGoogleServices ? './google-services.json' : undefined);

  return {
    ...config,
    android: {
      ...(config.android || {}),
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    plugins: [
      ...(config.plugins || []),
      [
        'react-native-google-mobile-ads',
        {
          androidAppId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || TEST_ADMOB_ANDROID_APP_ID,
          iosAppId: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || TEST_ADMOB_IOS_APP_ID,
          optimizeInitialization: true,
          optimizeAdLoading: true,
        },
      ],
    ],
    extra: {
      ...(config.extra || {}),
      pushNotifications: {
        ...(config.extra?.pushNotifications || {}),
        androidGoogleServicesFilePresent: Boolean(googleServicesFile),
      },
      pushRelayUrl: process.env.EXPO_PUBLIC_PUSH_RELAY_URL || '',
      admob: {
        ...(config.extra?.admob || {}),
        androidRewardedAdUnitId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_AD_UNIT_ID || '',
        iosRewardedAdUnitId: process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_AD_UNIT_ID || '',
      },
    },
  };
};
