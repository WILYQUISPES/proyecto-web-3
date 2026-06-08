const db = require('../config/db');

function normalizeIp(ip) {
  if (!ip) return 'desconocida';
  let v = String(ip).trim();
  if (v === '::1') return '127.0.0.1';
  if (v.startsWith('::ffff:')) v = v.slice(7);
  return v || 'desconocida';
}

function getIp(req) {
  const xfwd = req.headers['x-forwarded-for'];
  const raw = xfwd
    ? String(xfwd).split(',')[0].trim()
    : (req.ip || req.socket?.remoteAddress || '');
  return normalizeIp(raw);
}

function logAccess({ req, userId = null, username = null, event }) {
  try {
    const ip = getIp(req);
    const browser = req.headers['user-agent'] || 'desconocido';
    db.prepare(
      'INSERT INTO access_logs (user_id, username, ip, event, browser) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, username, ip, event, browser);
  } catch (err) {
    console.error('[logger] error:', err.message);
  }
}

module.exports = { logAccess, getIp };
