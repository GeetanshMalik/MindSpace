const admin = require('firebase-admin');
const { sendExpoPushNotifications } = require('../lib/expoPush');
const { getDb } = require('../lib/firebaseAdmin');
const { HttpError, json, optionalString, requireString, withAuth } = require('../lib/http');

const ALLOWED_TYPES = new Set([
  'like',
  'solidarity',
  'comment',
  'message',
  'friend_request',
  'friend_accepted',
  'streak',
  'reminder',
  'community',
]);

const DEFAULT_NOTIFICATION_PREFERENCES = {
  notificationsEnabled: true,
  dailyReminder: true,
  emailNotifications: true,
};

const tokenDocId = (token) => encodeURIComponent(token);

const sanitizeNotification = (uid, rawNotification) => {
  if (!rawNotification || typeof rawNotification !== 'object' || Array.isArray(rawNotification)) {
    throw new HttpError(400, 'notification is required.');
  }

  const type = requireString(rawNotification.type, 'notification.type', 40);
  if (!ALLOWED_TYPES.has(type)) {
    throw new HttpError(400, 'notification.type is not supported.');
  }

  const notification = {
    type,
    text: requireString(rawNotification.text, 'notification.text', 500),
  };

  const fromUserId = optionalString(rawNotification.fromUserId, 'notification.fromUserId', 128);
  if (fromUserId && fromUserId !== uid) {
    throw new HttpError(403, 'notification.fromUserId must match the authenticated user.');
  }
  if (fromUserId) notification.fromUserId = fromUserId;

  const optionalFields = [
    ['fromUserName', 120],
    ['postId', 160],
    ['commentId', 160],
    ['chatId', 220],
    ['friendshipId', 160],
  ];

  optionalFields.forEach(([fieldName, maxLength]) => {
    const value = optionalString(rawNotification[fieldName], `notification.${fieldName}`, maxLength);
    if (value) notification[fieldName] = value;
  });

  return notification;
};

const getNotificationPreferences = async (db, targetUserId, userData) => {
  const settingsSnap = await db.doc(`users/${targetUserId}/settings/preferences`).get();
  const data = settingsSnap.exists
    ? settingsSnap.data()
    : userData.notificationSettings || userData.appSettings || {};

  return {
    notificationsEnabled:
      data.notificationsEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.notificationsEnabled,
    dailyReminder:
      data.dailyReminder ?? DEFAULT_NOTIFICATION_PREFERENCES.dailyReminder,
    emailNotifications:
      data.emailNotifications ?? DEFAULT_NOTIFICATION_PREFERENCES.emailNotifications,
  };
};

const collectPushTokens = (userData, privatePushData) => {
  const tokens = new Set();
  const addToken = (token) => {
    if (typeof token === 'string' && token.trim()) tokens.add(token.trim());
  };

  if (Array.isArray(privatePushData.tokens)) {
    privatePushData.tokens.forEach(addToken);
  }
  addToken(privatePushData.primaryToken);

  if (Array.isArray(userData.pushTokens)) {
    userData.pushTokens.forEach(addToken);
  }
  addToken(userData.pushToken);

  return Array.from(tokens);
};

const pruneInvalidTokens = async (db, targetUserId, invalidTokens, privatePushData) => {
  const tokens = Array.from(new Set(invalidTokens)).filter(Boolean);
  if (!tokens.length) return;

  const update = {
    tokens: admin.firestore.FieldValue.arrayRemove(...tokens),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (tokens.includes(privatePushData.primaryToken)) {
    update.primaryToken = admin.firestore.FieldValue.delete();
  }

  const batch = db.batch();
  batch.set(db.doc(`users/${targetUserId}/private/push`), update, { merge: true });
  batch.set(
    db.doc(`users/${targetUserId}`),
    {
      pushTokens: admin.firestore.FieldValue.arrayRemove(...tokens),
      pushToken: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  tokens.forEach((token) => {
    batch.delete(db.doc(`pushTokenOwners/${tokenDocId(token)}`));
  });

  await batch.commit();
};

exports.handler = withAuth(async ({ body, uid }) => {
  const targetUserId = requireString(body.targetUserId, 'targetUserId', 128);
  const notification = sanitizeNotification(uid, body.notification);
  const db = getDb();

  const [targetUserSnap, privatePushSnap] = await Promise.all([
    db.doc(`users/${targetUserId}`).get(),
    db.doc(`users/${targetUserId}/private/push`).get(),
  ]);

  const userData = targetUserSnap.exists ? targetUserSnap.data() : {};
  const privatePushData = privatePushSnap.exists ? privatePushSnap.data() : {};
  const preferences = await getNotificationPreferences(db, targetUserId, userData);

  if (!preferences.notificationsEnabled) {
    return json(200, { ok: true, skipped: 'notifications-disabled' });
  }

  if ((notification.type === 'reminder' || notification.type === 'streak') && !preferences.dailyReminder) {
    return json(200, { ok: true, skipped: 'daily-reminder-disabled' });
  }

  const notificationRef = db.collection('notifications').doc(targetUserId).collection('items').doc();
  await notificationRef.set({
    ...notification,
    read: false,
    seenInBell: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const tokens = collectPushTokens(userData, privatePushData);
  let push = { attempted: 0, delivered: 0, invalidTokens: [] };

  try {
    push = await sendExpoPushNotifications(tokens, notification, targetUserId);
    await pruneInvalidTokens(db, targetUserId, push.invalidTokens, privatePushData);
  } catch (error) {
    console.warn('Notification was saved, but Expo push delivery failed:', error);
    push = {
      attempted: tokens.length,
      delivered: 0,
      invalidTokens: [],
      error: 'push-delivery-failed',
    };
  }

  return json(200, {
    ok: true,
    notificationId: notificationRef.id,
    push,
  });
});
