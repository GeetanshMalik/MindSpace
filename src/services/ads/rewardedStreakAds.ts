import Constants from 'expo-constants';
import { Platform } from 'react-native';

type GoogleMobileAdsModule = {
  default?: () => { initialize: () => Promise<unknown> };
  MobileAds?: () => { initialize: () => Promise<unknown> };
  RewardedAd: {
    createForAdRequest: (adUnitId: string, requestOptions?: Record<string, unknown>) => {
      load: () => void;
      show: () => Promise<void> | void;
      addAdEventListener: (type: string, listener: (payload?: unknown) => void) => () => void;
    };
  };
  RewardedAdEventType: {
    LOADED: string;
    EARNED_REWARD: string;
  };
  AdEventType: {
    CLOSED: string;
    ERROR: string;
  };
  TestIds: {
    REWARDED: string;
  };
};

const AD_LOAD_TIMEOUT_MS = 45000;
const TEST_ANDROID_REWARDED_AD_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917';
const TEST_IOS_REWARDED_AD_UNIT_ID = 'ca-app-pub-3940256099942544/1712485313';

let initializePromise: Promise<void> | null = null;

const getAdMobExtra = () => {
  const extra = Constants.expoConfig?.extra as
    | { admob?: { androidRewardedAdUnitId?: string; iosRewardedAdUnitId?: string } }
    | undefined;
  return extra?.admob || {};
};

const isExpoGo = () => Constants.appOwnership === 'expo';

const loadGoogleMobileAds = (): GoogleMobileAdsModule => {
  if (isExpoGo()) {
    throw new Error('Rewarded ads need a development or production build. Expo Go cannot show native AdMob ads.');
  }

  try {
    return require('react-native-google-mobile-ads/lib/commonjs') as GoogleMobileAdsModule;
  } catch {
    throw new Error('Rewarded ads are not installed in this build.');
  }
};

const getRewardedAdUnitId = (ads: GoogleMobileAdsModule) => {
  const extra = getAdMobExtra();
  const configuredAdUnitId = Platform.select({
    ios: extra.iosRewardedAdUnitId,
    android: extra.androidRewardedAdUnitId,
    default: undefined,
  });

  if (configuredAdUnitId) return configuredAdUnitId;

  return Platform.select({
    ios: TEST_IOS_REWARDED_AD_UNIT_ID,
    android: TEST_ANDROID_REWARDED_AD_UNIT_ID,
    default: ads.TestIds.REWARDED,
  }) as string;
};

export const initializeMobileAds = async () => {
  if (isExpoGo()) return false;

  const ads = loadGoogleMobileAds();
  const mobileAds = ads.default || ads.MobileAds;
  if (!mobileAds) return false;

  if (!initializePromise) {
    initializePromise = mobileAds()
      .initialize()
      .then(() => undefined)
      .catch((error) => {
        initializePromise = null;
        throw error;
      });
  }

  await initializePromise;
  return true;
};

const showSingleRewardedAd = async () => {
  const ads = loadGoogleMobileAds();
  await initializeMobileAds();

  const rewardedAd = ads.RewardedAd.createForAdRequest(getRewardedAdUnitId(ads), {
    requestNonPersonalizedAdsOnly: true,
  });

  return new Promise<boolean>((resolve, reject) => {
    let earnedReward = false;
    let settled = false;
    const unsubscribeFns: Array<() => void> = [];

    const finish = (result: boolean, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribeFns.forEach((unsubscribe) => unsubscribe());
      if (error) reject(error);
      else resolve(result);
    };

    const timeout = setTimeout(() => {
      finish(false, new Error('Advertisement timed out while loading. Please try again.'));
    }, AD_LOAD_TIMEOUT_MS);

    unsubscribeFns.push(
      rewardedAd.addAdEventListener(ads.RewardedAdEventType.LOADED, () => {
        Promise.resolve(rewardedAd.show()).catch((error) => {
          finish(false, error instanceof Error ? error : new Error('Could not show advertisement.'));
        });
      })
    );

    unsubscribeFns.push(
      rewardedAd.addAdEventListener(ads.RewardedAdEventType.EARNED_REWARD, () => {
        earnedReward = true;
      })
    );

    unsubscribeFns.push(
      rewardedAd.addAdEventListener(ads.AdEventType.CLOSED, () => {
        finish(earnedReward);
      })
    );

    unsubscribeFns.push(
      rewardedAd.addAdEventListener(ads.AdEventType.ERROR, (error) => {
        finish(false, error instanceof Error ? error : new Error('Could not load advertisement.'));
      })
    );

    rewardedAd.load();
  });
};

export const showStreakRestoreAdSequence = async (
  requiredAds: number,
  onProgress?: (currentAd: number, totalAds: number) => void
) => {
  const totalAds = Math.max(1, requiredAds);

  for (let currentAd = 1; currentAd <= totalAds; currentAd += 1) {
    onProgress?.(currentAd, totalAds);
    const completed = await showSingleRewardedAd();
    if (!completed) return false;
  }

  return true;
};
