const express = require('express');
const { body, param, query, validationResult } = require('express-validator');

const db = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');

const router = express.Router();

router.use(verifyToken);

router.get(
  '/',
  [
    query('search').optional().isString().trim(),
    query('includeDeleted').optional().isBoolean().toBoolean()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { search, includeDeleted } = req.query;
    const where = [];
    const params = [];

    if (!includeDeleted || req.user.role !== 'admin') where.push('is_active = 1');
    if (search) {
      where.push('(LOWER(name) LIKE ? OR LOWER(contact_name) LIKE ? OR LOWER(email) LIKE ?)');
      const term = `%${String(search).toLowerCase()}%`;
      params.push(term, term, term);
    }

    const sql = `SELECT * FROM suppliers ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY name ASC`;
    res.json(db.prepare(sql).all(...params));
  }
);

router.get('/:id', [param('id').isInt()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Proveedor no encontrado' });
  res.json(row);
});

const supplierValidators = [
  body('name').isString().trim().isLength({ min: 1, max: 100 }),
  body('contact_name').optional({ nullable: true }).isString().trim().isLength({ max: 80 }),
  body('phone').optional({ nullable: true }).isString().trim()
    .matches(/^[0-9+\-\s()]*$/).withMessage('Teléfono inválido').isLength({ max: 30 }),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Email inválido').normalizeEmail(),
  body('address').optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
  body('ruc').optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 500 })
];

router.post('/', supplierValidators, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, contact_name, phone, email, address, ruc, notes } = req.body;
  const result = db.prepare(`
    INSERT INTO suppliers (name, contact_name, phone, email, address, ruc, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, contact_name || null, phone || null, email || null, address || null, ruc || null, notes || null);
  res.status(201).json(db.prepare('SELECT * FROM suppliers WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', [param('id').isInt(), ...supplierValidators], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Proveedor no encontrado' });

  const { name, contact_name, phone, email, address, ruc, notes } = req.body;
  db.prepare(`
    UPDATE suppliers
    SET name = ?, contact_name = ?, phone = ?, email = ?, address = ?, ruc = ?, notes = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(name, contact_name || null, phone || null, email || null, address || null, ruc || null, notes || null, id);

  res.json(db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id));
});

router.delete('/:id', [param('id').isInt()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Proveedor no encontrado' });
  db.prepare("UPDATE suppliers SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  res.json({ ok: true, id, message: 'Proveedor eliminado (lógico)' });
});

router.post('/:id/restore', requireAdmin, [param('id').isInt()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = Number(req.params.id);
  db.prepare("UPDATE suppliers SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(id);
  res.json({ ok: true, id, message: 'Proveedor restaurado' });
});

module.exports = router;
