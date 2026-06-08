const db = require('../config/db');

function getIp(req) {
  const xfwd = req.headers['x-forwarded-for'];
  if (xfwd) return String(xfwd).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'desconocida';
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
