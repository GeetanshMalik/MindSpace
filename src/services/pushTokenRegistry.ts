import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  arrayRemove,
  arrayUnion,
  deleteField,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase/config';
import { registerForPushNotificationsAsync } from './pushNotifications';
import {
  isPushRelayConfigured,
  registerPushTokenThroughRelay,
  unregisterPushTokenThroughRelay,
} from './pushRelay';

const PUSH_TOKEN_KEY = '@mindspace/currentExpoPushToken';
const PUSH_OWNER_KEY = '@mindspace/currentExpoPushOwnerUid';

const tokenDocId = (token: string) => encodeURIComponent(token);

const clearPrivatePushTokensForUser = async (userId: string) => {
  await setDoc(
    doc(db, 'users', userId, 'private', 'push'),
    {
      tokens: [],
      primaryToken: deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

const clearLegacyPushTokensForUser = async (userId: string) => {
  await setDoc(
    doc(db, 'users', userId),
    {
      pushTokens: [],
      pushToken: deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

const removePrivatePushTokenFromUser = async (userId: string, token: string) => {
  if (!token) return;
  await setDoc(
    doc(db, 'users', userId, 'private', 'push'),
    {
      tokens: arrayRemove(token),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

const addPrivatePushTokenToUser = async (userId: string, token: string) => {
  await setDoc(
    doc(db, 'users', userId, 'private', 'push'),
    {
      tokens: arrayUnion(token),
      primaryToken: token,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

const addLegacyPushTokenToUser = async (userId: string, token: string) => {
  await setDoc(
    doc(db, 'users', userId),
    {
      pushTokens: [token],
      pushToken: token,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

const claimPushTokenOwner = async (userId: string, token: string) => {
  await setDoc(
    doc(db, 'pushTokenOwners', tokenDocId(token)),
    {
      token,
      userId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

const registerTokenLocally = async (userId: string, token: string, includeLegacyPublicToken: boolean) => {
  await addPrivatePushTokenToUser(userId, token);
  await claimPushTokenOwner(userId, token);
  if (includeLegacyPublicToken) {
    await addLegacyPushTokenToUser(userId, token);
  }
};

export const registerPushTokenForUser = async (userId: string) => {
  const previousOwner = await AsyncStorage.getItem(PUSH_OWNER_KEY);
  const previousToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);

  await clearPrivatePushTokensForUser(userId).catch((error) => {
    console.warn('Could not clear stale push tokens for current user:', error);
  });

  if (!isPushRelayConfigured()) {
    await clearLegacyPushTokensForUser(userId).catch((error) => {
      console.warn('Could not clear legacy push tokens for current user:', error);
    });
  }

  const token = await registerForPushNotificationsAsync();
  if (!token) {
    await AsyncStorage.multiRemove([PUSH_TOKEN_KEY, PUSH_OWNER_KEY]);
    return null;
  }

  if (previousOwner && previousOwner !== userId && previousToken) {
    console.log('Push token owner changed; new owner claim will replace stale delivery ownership.');
  }

  if (isPushRelayConfigured()) {
    await registerPushTokenThroughRelay(token).catch(async (error) => {
      console.warn('Push relay token registration failed; using owner-only local fallback:', error);
      await registerTokenLocally(userId, token, false);
    });
  } else {
    await registerTokenLocally(userId, token, true);
  }

  await AsyncStorage.multiSet([
    [PUSH_TOKEN_KEY, token],
    [PUSH_OWNER_KEY, userId],
  ]);

  return token;
};

export const unregisterPushTokenForUser = async (userId?: string | null) => {
  const [storedToken, storedOwner] = await Promise.all([
    AsyncStorage.getItem(PUSH_TOKEN_KEY),
    AsyncStorage.getItem(PUSH_OWNER_KEY),
  ]);

  const ownerUid = userId || storedOwner;
  if (ownerUid && storedToken) {
    if (isPushRelayConfigured()) {
      await unregisterPushTokenThroughRelay(storedToken).catch(async (error) => {
        console.warn('Push relay token unregister failed; using local fallback:', error);
        await removePrivatePushTokenFromUser(ownerUid, storedToken).catch(() => {});
      });
    } else {
      await removePrivatePushTokenFromUser(ownerUid, storedToken).catch((error) => {
        console.warn('Could not remove private push token from user:', error);
      });
      await clearLegacyPushTokensForUser(ownerUid).catch((error) => {
        console.warn('Could not clear legacy push token from user:', error);
      });
    }
  }

  if (!userId || userId === storedOwner) {
    await AsyncStorage.multiRemove([PUSH_TOKEN_KEY, PUSH_OWNER_KEY]);
  }
};
