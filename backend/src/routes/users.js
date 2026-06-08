const express = require('express');
const { body, param, validationResult } = require('express-validator');

const db = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');

const router = express.Router();

router.use(verifyToken, requireAdmin);

router.get('/', (req, res) => {
  const rows = db.prepare(
    'SELECT id, username, email, role, is_active, created_at FROM users ORDER BY created_at DESC'
  ).all();
  res.json(rows);
});

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
