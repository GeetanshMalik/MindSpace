const { verifyAuthHeader } = require('./firebaseAdmin');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

const json = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

const empty = (statusCode) => ({
  statusCode,
  headers: corsHeaders,
  body: '',
});

const parseJsonBody = (event) => {
  if (!event.body) return {};

  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'Invalid JSON body.');
  }
};

const requireString = (value, fieldName, maxLength = 500) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(400, `${fieldName} is required.`);
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new HttpError(400, `${fieldName} is too long.`);
  }

  return trimmed;
};

const optionalString = (value, fieldName, maxLength = 500) => {
  if (value === undefined || value === null || value === '') return undefined;
  return requireString(value, fieldName, maxLength);
};

const withAuth = (handler) => async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return empty(204);
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  try {
    const body = parseJsonBody(event);
    const auth = await verifyAuthHeader(event.headers.authorization || event.headers.Authorization);
    const result = await handler({ event, context, body, auth, uid: auth.uid });
    return result || json(200, { ok: true });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'Internal server error.' : error.message;

    if (statusCode === 500) {
      console.error(error);
    }

    return json(statusCode, { error: message });
  }
};

module.exports = {
  HttpError,
  json,
  optionalString,
  requireString,
  withAuth,
};
