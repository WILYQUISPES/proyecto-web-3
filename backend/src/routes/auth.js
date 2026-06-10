const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const svgCaptcha = require('svg-captcha');
const crypto = require('node:crypto');
const { body, validationResult } = require('express-validator');

const db = require('../config/db');
const { checkStrength } = require('../utils/password');
const { logAccess } = require('../utils/logger');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const CAPTCHA_TTL_MS = 5 * 60 * 1000;

router.get('/captcha', (req, res) => {
  const captcha = svgCaptcha.create({
    size: 5,
    noise: 3,
    color: true,
    background: '#f5f5f5',
    ignoreChars: '0o1iIl'
  });

  const token = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + CAPTCHA_TTL_MS;

  db.prepare(
    'INSERT INTO captchas (token, value, expires_at) VALUES (?, ?, ?)'
  ).run(token, captcha.text.toLowerCase(), expiresAt);

  res.json({ token, svg: captcha.data });
});

function consumeCaptcha(token, value) {
  if (!token || !value) return false;
  const row = db.prepare('SELECT * FROM captchas WHERE token = ?').get(token);
  if (!row) return false;
  db.prepare('DELETE FROM captchas WHERE token = ?').run(token);
  if (row.expires_at < Date.now()) return false;
  return row.value === String(value).toLowerCase();
}

router.post('/password-strength', (req, res) => {
  const { password } = req.body || {};
  res.json(checkStrength(password || ''));
});

router.post(
  '/login',
  [
    body('username').isString().trim().notEmpty(),
    body('password').isString().notEmpty(),
    body('captchaToken').isString().notEmpty(),
    body('captchaValue').isString().notEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, password, captchaToken, captchaValue } = req.body;

    if (!consumeCaptcha(captchaToken, captchaValue)) {
      logAccess({ req, username, event: 'LOGIN_FAIL_CAPTCHA' });
      return res.status(400).json({ error: 'CAPTCHA inválido o expirado' });
    }

    const user = db.prepare(
      'SELECT * FROM users WHERE username = ? AND is_active = 1'
    ).get(username);

    if (!user) {
      logAccess({ req, username, event: 'LOGIN_FAIL' });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) {
      logAccess({ req, userId: user.id, username, event: 'LOGIN_FAIL' });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || '8h' }
    );

    logAccess({ req, userId: user.id, username: user.username, event: 'LOGIN' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  }
);

router.post('/logout', verifyToken, (req, res) => {
  logAccess({
    req,
    userId: req.user.id,
    username: req.user.username,
    event: 'LOGOUT'
  });
  res.json({ ok: true });
});

router.get('/me', verifyToken, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, email, role, is_active, created_at FROM users WHERE id = ?'
  ).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
});

module.exports = router;
