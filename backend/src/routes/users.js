const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param, validationResult } = require('express-validator');

const db = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');
const { checkStrength } = require('../utils/password');

const router = express.Router();

router.use(verifyToken, requireAdmin);

router.get('/', (req, res) => {
  const rows = db.prepare(
    'SELECT id, username, email, role, is_active, created_at FROM users ORDER BY created_at DESC'
  ).all();
  res.json(rows);
});

router.post(
  '/',
  [
    body('username').isString().trim().isLength({ min: 3, max: 30 })
      .matches(/^[a-zA-Z0-9_.-]+$/).withMessage('Usuario inválido'),
    body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
    body('password').isString().isLength({ min: 6, max: 128 })
      .withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('role').optional().isIn(['admin', 'user']).withMessage('Rol inválido'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, email, password } = req.body;
    const role = req.body.role === 'admin' ? 'admin' : 'user';

    const strength = checkStrength(password);
    if (strength.level === 'debil') {
      return res.status(400).json({ error: 'La contraseña es muy débil' });
    }

    const exists = db.prepare(
      'SELECT id FROM users WHERE username = ? OR email = ?'
    ).get(username, email);
    if (exists) return res.status(409).json({ error: 'Usuario o email ya registrado' });

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(username, email, hash, role);

    res.status(201).json({
      id: result.lastInsertRowid,
      username, email, role, strength,
    });
  }
);

router.patch(
  '/:id/toggle',
  [param('id').isInt()],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const id = Number(req.params.id);
    if (id === req.user.id) {
      return res.status(400).json({ error: 'No podés desactivar tu propia cuenta' });
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const next = user.is_active ? 0 : 1;
    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(next, id);
    res.json({ ok: true, id, is_active: next });
  }
);

router.patch(
  '/:id/role',
  [param('id').isInt(), body('role').isIn(['admin', 'user'])],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const id = Number(req.params.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(req.body.role, id);
    res.json({ ok: true, id, role: req.body.role });
  }
);

module.exports = router;
