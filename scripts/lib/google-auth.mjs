import { createPrivateKey, createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function decodeBase64(value, label) {
  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch {
    throw new Error(`Could not decode Base64 ${label}.`);
  }
}

function parseCredentials(raw) {
  if (!raw?.trim()) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw.trim().replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('Google service-account JSON is invalid. Configure the complete downloaded JSON document or its Base64-encoded contents.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Google service-account JSON must be a JSON object.');
  }
  return parsed;
}

function normalizePrivateKey(value) {
  let key = String(value ?? '').trim().replace(/^\uFEFF/, '');
  if (key.startsWith('base64:')) key = decodeBase64(key.slice(7).trim(), 'private key').trim();
  if (key.startsWith('"') && key.endsWith('"')) {
    try {
      const parsed = JSON.parse(key);
      if (typeof parsed === 'string') key = parsed;
    } catch {
      key = key.slice(1, -1);
    }
  } else if (key.startsWith("'") && key.endsWith("'")) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\r\n?/g, '\n').trim();
}

export function getGoogleServiceAccountCredentials() {
  const encodedJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  const json = encodedJson
    ? parseCredentials(decodeBase64(encodedJson, 'service-account JSON'))
    : parseCredentials(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

  const email = String(json?.client_email ?? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? '').trim();
  const encodedPem = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64?.trim();
  const rawKey = json
    ? json.private_key
    : encodedPem
      ? decodeBase64(encodedPem, 'private key')
      : process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || typeof rawKey !== 'string' || !rawKey.trim()) {
    throw new Error('Google service-account credentials are missing. Set GOOGLE_SERVICE_ACCOUNT_JSON_BASE64, GOOGLE_SERVICE_ACCOUNT_JSON, or GOOGLE_SERVICE_ACCOUNT_EMAIL with GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.');
  }

  const key = normalizePrivateKey(rawKey);
  if (!key.startsWith('-----BEGIN ') || !key.includes('PRIVATE KEY-----') || !key.includes('-----END ')) {
    throw new Error('The Google service-account private key is incomplete. Use the full private_key from the downloaded service-account JSON.');
  }

  let privateKey;
  try {
    privateKey = createPrivateKey({ key: `${key}\n`, format: 'pem' });
  } catch {
    throw new Error('The Google service-account private key could not be parsed. Check the JSON key or create a new service-account key.');
  }
  if (privateKey.asymmetricKeyType !== 'rsa') {
    throw new Error(`Google service-account key must be RSA for RS256 signing (received ${privateKey.asymmetricKeyType ?? 'unknown'}).`);
  }
  return { email, privateKey, keyId: typeof json?.private_key_id === 'string' ? json.private_key_id.trim() : undefined };
}

export function assertGoogleCredentialsConfigured() {
  getGoogleServiceAccountCredentials();
}

export function createGoogleJwtAssertion(scope) {
  const { email, privateKey, keyId } = getGoogleServiceAccountCredentials();
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT', ...(keyId ? { kid: keyId } : {}) })}.${encode({
    iss: email,
    scope,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(privateKey, 'base64url')}`;
}
