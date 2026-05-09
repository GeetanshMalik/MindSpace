const admin = require('firebase-admin');

const DEFAULT_PROJECT_ID = 'mindspace33756';

const normalizePrivateKey = (value) => {
  if (!value) return value;
  return value.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
};

const parseServiceAccountJson = (rawValue) => {
  if (!rawValue) return null;

  const raw = rawValue.trim();
  const json = raw.startsWith('{')
    ? raw
    : Buffer.from(raw, 'base64').toString('utf8');
  const serviceAccount = JSON.parse(json);

  if (serviceAccount.private_key) {
    serviceAccount.private_key = normalizePrivateKey(serviceAccount.private_key);
  }

  return serviceAccount;
};

const getServiceAccount = () => {
  const jsonAccount = parseServiceAccountJson(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
  );

  if (jsonAccount) return jsonAccount;

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    DEFAULT_PROJECT_ID;

  if (clientEmail && privateKey) {
    return {
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey,
    };
  }

  throw new Error(
    'Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.'
  );
};

const getAdmin = () => {
  if (!admin.apps.length) {
    const serviceAccount = getServiceAccount();
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID,
    });
  }

  return admin;
};

const getDb = () => getAdmin().firestore();

const verifyAuthHeader = async (authorizationHeader) => {
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader || '');
  if (!match) {
    const error = new Error('Missing Authorization bearer token.');
    error.statusCode = 401;
    throw error;
  }

  return getAdmin().auth().verifyIdToken(match[1]);
};

module.exports = {
  getAdmin,
  getDb,
  verifyAuthHeader,
};
