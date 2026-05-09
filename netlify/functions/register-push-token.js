const admin = require('firebase-admin');
const { getDb } = require('../lib/firebaseAdmin');
const { HttpError, json, requireString, withAuth } = require('../lib/http');

const tokenDocId = (token) => encodeURIComponent(token);

const validateExpoPushToken = (token) => {
  const value = requireString(token, 'token', 256);
  if (!/^Expo(nent)?PushToken\[[^\]]+\]$/.test(value)) {
    throw new HttpError(400, 'token must be a valid Expo push token.');
  }
  return value;
};

exports.handler = withAuth(async ({ body, uid }) => {
  const token = validateExpoPushToken(body.token);
  const db = getDb();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const ownerRef = db.doc(`pushTokenOwners/${tokenDocId(token)}`);

  await db.runTransaction(async (transaction) => {
    const ownerSnap = await transaction.get(ownerRef);
    const previousOwnerId = ownerSnap.exists ? ownerSnap.data().userId : null;

    if (previousOwnerId && previousOwnerId !== uid) {
      const previousPrivateRef = db.doc(`users/${previousOwnerId}/private/push`);
      const previousPrivateSnap = await transaction.get(previousPrivateRef);
      const previousPrivateUpdate = {
        tokens: admin.firestore.FieldValue.arrayRemove(token),
        updatedAt: now,
      };

      if (previousPrivateSnap.exists && previousPrivateSnap.data().primaryToken === token) {
        previousPrivateUpdate.primaryToken = admin.firestore.FieldValue.delete();
      }

      transaction.set(previousPrivateRef, previousPrivateUpdate, { merge: true });
      transaction.set(
        db.doc(`users/${previousOwnerId}`),
        {
          pushTokens: admin.firestore.FieldValue.arrayRemove(token),
          pushToken: admin.firestore.FieldValue.delete(),
          updatedAt: now,
        },
        { merge: true }
      );
    }

    transaction.set(
      db.doc(`users/${uid}/private/push`),
      {
        tokens: admin.firestore.FieldValue.arrayUnion(token),
        primaryToken: token,
        updatedAt: now,
      },
      { merge: true }
    );

    transaction.set(
      ownerRef,
      {
        token,
        userId: uid,
        updatedAt: now,
      },
      { merge: true }
    );
  });

  return json(200, { ok: true });
});
