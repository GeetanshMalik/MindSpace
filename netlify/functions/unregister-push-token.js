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
    const ownerId = ownerSnap.exists ? ownerSnap.data().userId : uid;

    if (ownerId !== uid) {
      throw new HttpError(403, 'This push token belongs to another user.');
    }

    const privateRef = db.doc(`users/${uid}/private/push`);
    const privateSnap = await transaction.get(privateRef);
    const privateUpdate = {
      tokens: admin.firestore.FieldValue.arrayRemove(token),
      updatedAt: now,
    };

    if (privateSnap.exists && privateSnap.data().primaryToken === token) {
      privateUpdate.primaryToken = admin.firestore.FieldValue.delete();
    }

    transaction.set(privateRef, privateUpdate, { merge: true });
    transaction.set(
      db.doc(`users/${uid}`),
      {
        pushTokens: admin.firestore.FieldValue.arrayRemove(token),
        pushToken: admin.firestore.FieldValue.delete(),
        updatedAt: now,
      },
      { merge: true }
    );

    if (ownerSnap.exists) {
      transaction.delete(ownerRef);
    }
  });

  return json(200, { ok: true });
});
