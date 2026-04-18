export function json(res, status, payload) {
  res.status(status).setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

export function onlyMethods(req, res, methods = []) {
  if (!methods.includes(req.method)) {
    json(res, 405, { error: 'Method not allowed' });
    return false;
  }
  return true;
}
