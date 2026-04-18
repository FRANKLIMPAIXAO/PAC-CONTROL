import crypto from 'crypto';

const ONE_DAY = 24 * 60 * 60;

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function sign(content, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(content)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function createSessionToken(payload, secret = process.env.SESSION_SECRET) {
  if (!secret) throw new Error('SESSION_SECRET is required');

  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: now,
    exp: now + ONE_DAY
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const signature = sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token, secret = process.env.SESSION_SECRET) {
  if (!secret || !token) return null;

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expected = sign(encodedPayload, secret);
  if (signature.length !== expected.length) return null;

  const safeEqual = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!safeEqual) return null;

  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) return null;

  return payload;
}
