const express = require('express');
const { body, param, query, validationResult } = require('express-validator');

const db = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');

const router = express.Router();

const UNITS = ['m²', 'm', 'kg', 'g', 'litro', 'par', 'unidad', 'carrete', 'rollo'];

router.use(verifyToken);

router.get(
  '/',
  [
    query('search').optional().isString().trim(),
    query('supplier_id').optional().isInt().toInt(),
    query('includeDeleted').optional().isBoolean().toBoolean()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { search, supplier_id, includeDeleted } = req.query;
    const where = [];
    const params = [];

    if (!includeDeleted || req.user.role !== 'admin') where.push('m.is_active = 1');
    if (search) {
      where.push('LOWER(m.name) LIKE ?');
      params.push(`%${String(search).toLowerCase()}%`);
    }
    if (supplier_id) {
      where.push('m.supplier_id = ?');
      params.push(Number(supplier_id));
    }

    const sql = `
      SELECT m.*, s.name AS supplier_name
      FROM raw_materials m
      LEFT JOIN suppliers s ON s.id = m.supplier_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY m.name ASC
    `;
    res.json(db.prepare(sql).all(...params));
  }
);

router.get('/meta/units', (req, res) => res.json({ units: UNITS }));

router.get('/:id', [param('id').isInt()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const row = db.prepare(`
    SELECT m.*, s.name AS supplier_name
    FROM raw_materials m
    LEFT JOIN suppliers s ON s.id = m.supplier_id
    WHERE m.id = ?
  `).get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Material no encontrado' });
  res.json(row);
});

const materialValidators = [
  body('name').isString().trim().isLength({ min: 1, max: 100 }),
  body('unit').isString().trim().isIn(UNITS).withMessage(`Unidad debe ser una de: ${UNITS.join(', ')}`),
  body('stock').isFloat({ min: 0, max: 9999999 }).toFloat(),
  body('unit_cost').isFloat({ min: 0, max: 99999999 }).toFloat(),
  body('supplier_id').optional({ nullable: true }).isInt().toInt(),
  body('description').optional({ nullable: true }).isString().trim().isLength({ max: 500 })
];

router.post('/', materialValidators, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, unit, stock, unit_cost, supplier_id, description } = req.body;
  const result = db.prepare(`
    INSERT INTO raw_materials (name, unit, stock, unit_cost, supplier_id, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, unit, stock, unit_cost, supplier_id || null, description || null);

  res.status(201).json(db.prepare(`
    SELECT m.*, s.name AS supplier_name
    FROM raw_materials m LEFT JOIN suppliers s ON s.id = m.supplier_id
    WHERE m.id = ?
  `).get(result.lastInsertRowid));
});

router.put('/:id', [param('id').isInt(), ...materialValidators], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM raw_materials WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Material no encontrado' });

  const { name, unit, stock, unit_cost, supplier_id, description } = req.body;
  db.prepare(`
    UPDATE raw_materials
    SET name = ?, unit = ?, stock = ?, unit_cost = ?, supplier_id = ?, description = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(name, unit, stock, unit_cost, supplier_id || null, description || null, id);

  res.json(db.prepare(`
    SELECT m.*, s.name AS supplier_name
    FROM raw_materials m LEFT JOIN suppliers s ON s.id = m.supplier_id
    WHERE m.id = ?
  `).get(id));
});

router.delete('/:id', [param('id').isInt()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM raw_materials WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Material no encontrado' });
  db.prepare("UPDATE raw_materials SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  res.json({ ok: true, id, message: 'Material eliminado (lógico)' });
});

router.post('/:id/restore', requireAdmin, [param('id').isInt()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = Number(req.params.id);
  db.prepare("UPDATE raw_materials SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(id);
  res.json({ ok: true, id, message: 'Material restaurado' });
});

module.exports = router;
