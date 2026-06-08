const express = require('express');
const { body, param, query, validationResult } = require('express-validator');

const db = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');

const router = express.Router();

const TYPES = ['Zapato', 'Bota', 'Botín', 'Zapatilla', 'Sandalia', 'Mocasín'];
const MATERIALS = ['Cuero', 'Gamuza', 'Sintético', 'Tela', 'Lona'];

router.use(verifyToken);

router.get(
  '/',
  [
    query('search').optional().isString().trim(),
    query('type').optional().isString().trim(),
    query('material').optional().isString().trim(),
    query('includeDeleted').optional().isBoolean().toBoolean()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { search, type, material, includeDeleted } = req.query;
    const where = [];
    const params = [];

    if (!includeDeleted || req.user.role !== 'admin') {
      where.push('is_active = 1');
    }
    if (search) {
      where.push('(LOWER(model_name) LIKE ? OR LOWER(color) LIKE ? OR LOWER(description) LIKE ?)');
      const term = `%${String(search).toLowerCase()}%`;
      params.push(term, term, term);
    }
    if (type) {
      where.push('LOWER(type) = ?');
      params.push(String(type).toLowerCase());
    }
    if (material) {
      where.push('LOWER(material) = ?');
      params.push(String(material).toLowerCase());
    }

    const sql = `SELECT * FROM products ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  }
);

router.get('/meta/options', (req, res) => {
  res.json({ types: TYPES, materials: MATERIALS });
});

router.get('/:id', [param('id').isInt()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Producto no encontrado' });

  const materials = db.prepare(`
    SELECT pm.id AS link_id, pm.quantity, m.id, m.name, m.unit, m.unit_cost, s.name AS supplier_name
    FROM product_materials pm
    JOIN raw_materials m ON m.id = pm.raw_material_id
    LEFT JOIN suppliers s ON s.id = m.supplier_id
    WHERE pm.product_id = ?
    ORDER BY m.name ASC
  `).all(id);

  res.json({ ...row, materials });
});

router.get('/:id/materials', [param('id').isInt()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = Number(req.params.id);
  const rows = db.prepare(`
    SELECT pm.id AS link_id, pm.quantity, m.id, m.name, m.unit, m.unit_cost, s.name AS supplier_name
    FROM product_materials pm
    JOIN raw_materials m ON m.id = pm.raw_material_id
    LEFT JOIN suppliers s ON s.id = m.supplier_id
    WHERE pm.product_id = ?
    ORDER BY m.name ASC
  `).all(id);
  res.json(rows);
});

router.put('/:id/materials', [
  param('id').isInt(),
  body('materials').isArray(),
  body('materials.*.raw_material_id').isInt().toInt(),
  body('materials.*.quantity').isFloat({ min: 0.001 }).toFloat()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const id = Number(req.params.id);
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

  db.prepare('DELETE FROM product_materials WHERE product_id = ?').run(id);
  const insert = db.prepare('INSERT INTO product_materials (product_id, raw_material_id, quantity) VALUES (?, ?, ?)');
  const seen = new Set();
  for (const m of req.body.materials) {
    if (seen.has(m.raw_material_id)) continue;
    seen.add(m.raw_material_id);
    insert.run(id, m.raw_material_id, m.quantity);
  }
  res.json({ ok: true, count: seen.size });
});

const productValidators = [
  body('model_name').isString().trim().isLength({ min: 1, max: 80 }),
  body('type').isString().trim().isIn(TYPES).withMessage(`Tipo debe ser uno de: ${TYPES.join(', ')}`),
  body('material').isString().trim().isIn(MATERIALS).withMessage(`Material debe ser uno de: ${MATERIALS.join(', ')}`),
  body('color').isString().trim().isLength({ min: 1, max: 30 }),
  body('size').isInt({ min: 18, max: 50 }).toInt().withMessage('Talla entre 18 y 50'),
  body('price').isFloat({ min: 0, max: 99999999 }).toFloat().withMessage('Precio inválido'),
  body('stock').isInt({ min: 0, max: 999999 }).toInt().withMessage('Stock inválido'),
  body('description').optional({ nullable: true }).isString().trim().isLength({ max: 500 })
];

router.post('/', productValidators, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { model_name, type, material, color, size, price, stock, description } = req.body;
  const result = db.prepare(`
    INSERT INTO products (model_name, type, material, color, size, price, stock, description, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(model_name, type, material, color, size, price, stock, description || null, req.user.id);

  const created = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

router.put('/:id', [param('id').isInt(), ...productValidators], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

  const { model_name, type, material, color, size, price, stock, description } = req.body;
  db.prepare(`
    UPDATE products
    SET model_name = ?, type = ?, material = ?, color = ?, size = ?, price = ?,
        stock = ?, description = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(model_name, type, material, color, size, price, stock, description || null, id);

  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
});

router.delete('/:id', [param('id').isInt()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

  db.prepare("UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  res.json({ ok: true, id, message: 'Producto eliminado (lógico)' });
});

router.post('/:id/restore', requireAdmin, [param('id').isInt()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const id = Number(req.params.id);
  db.prepare("UPDATE products SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(id);
  res.json({ ok: true, id, message: 'Producto restaurado' });
});

module.exports = router;
