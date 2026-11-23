const crypto = require('crypto');

const ADMIN_ACCOUNTS = {
  hoabs04: 'hoabs123',
  nhuquynh: 'quyncute'
};

if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
  ADMIN_ACCOUNTS[process.env.ADMIN_USERNAME.trim()] = process.env.ADMIN_PASSWORD;
}

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'hoabs04';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'cinema-watch-party-secret-key-2026';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 giờ

function verifyCredentials(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') {
    return false;
  }
  const cleanUser = username.trim();
  return Object.prototype.hasOwnProperty.call(ADMIN_ACCOUNTS, cleanUser) &&
    ADMIN_ACCOUNTS[cleanUser] === password;
}

function generateAdminToken(username = ADMIN_USERNAME) {
  const payload = {
    username,
    role: 'admin',
    exp: Date.now() + TOKEN_TTL_MS
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', ADMIN_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${signature}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null;
  }
  const [payloadB64, signature] = token.split('.');
  if (!payloadB64 || !signature) return null;

  const expectedSig = crypto
    .createHmac('sha256', ADMIN_SECRET)
    .update(payloadB64)
    .digest('base64url');

  if (signature !== expectedSig) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload || payload.role !== 'admin' || typeof payload.exp !== 'number') {
      return null;
    }
    if (Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  ADMIN_USERNAME,
  verifyCredentials,
  generateAdminToken,
  verifyAdminToken
};
