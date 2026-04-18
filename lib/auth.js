import { json } from './http.js';

export function requireBearer(req, res, expectedToken) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!expectedToken || token !== expectedToken) {
    json(res, 401, { error: 'Unauthorized' });
    return false;
  }

  return true;
}
