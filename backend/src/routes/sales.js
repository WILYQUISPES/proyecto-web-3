const express = require('express');
const { body, param, query, validationResult } = require('express-validator');

const db = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');

const router = express.Router();

const PAYMENT_METHODS = ['Efectivo', 'Transferencia', 'Tarjeta', 'Cheque'];

router.use(verifyToken);

router.get(
  '/',
  [
    query('search').optional().isString().trim(),
    query('from').optional().isString().trim(),
    query('to').optional().isString().trim(),
    query('includeDeleted').optional().isBoolean().toBoolean(),
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { search, from, to, includeDeleted } = req.query;
    const limit = req.query.limit || 200;
    const where = [];
    const params = [];

    if (!includeDeleted || req.user.role !== 'admin') where.push('s.is_active = 1');
    if (search) {
      where.push('(LOWER(s.customer_name) LIKE ? OR s.sale_number LIKE ?)');
      const term = `%${String(search).toLowerCase()}%`;
      params.push(term, `%${search}%`);
    }
    if (from) { where.push('DATE(s.created_at) >= DATE(?)'); params.push(from); }
    if (to)   { where.push('DATE(s.created_at) <= DATE(?)'); params.push(to); }

    const sql = `
      SELECT s.*, u.username AS created_by_username,
        (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) AS items_count
      FROM sales s
      LEFT JOIN users u ON u.id = s.created_by
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY s.created_at DESC
      LIMIT ?
    `;
    params.push(limit);
    res.json(db.prepare(sql).all(...params));
  }
);

router.get('/meta/options', (req, res) => res.json({ paymentMethods: PAYMENT_METHODS }));

router.get('/:id', [param('id').isInt()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const id = Number(req.params.id);
  const sale = db.prepare(`
    SELECT s.*, u.username AS created_by_username
    FROM sales s LEFT JOIN users u ON u.id = s.created_by
    WHERE s.id = ?
  `).get(id);
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });

  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
  res.json({ ...sale, items });
});

router.post(
  '/',
  [
    body('customer_name').isString().trim().isLength({ min: 1, max: 100 }),
    body('customer_doc').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 30 }),
    body('payment_method').isIn(PAYMENT_METHODS),
    body('discount_pct').optional({ nullable: true }).isFloat({ min: 0, max: 100 }).toFloat(),
    body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
    body('items').isArray({ min: 1 }).withMessage('Debe agregar al menos un producto'),
    body('items.*.product_id').isInt().toInt(),
    body('items.*.quantity').isInt({ min: 1, max: 9999 }).toInt(),
    body('items.*.unit_price').optional().isFloat({ min: 0 }).toFloat()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { customer_name, customer_doc, payment_method, items, notes } = req.body;
    const discountPct = Number(req.body.discount_pct) || 0;

    const productCache = new Map();
    let subtotal = 0; let totalCost = 0;
    const linesData = [];

    for (const it of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(it.product_id);
      if (!product) return res.status(400).json({ error: `Producto ID ${it.product_id} no encontrado` });
      if (!product.is_active) return res.status(400).json({ error: `Producto "${product.model_name}" no está activo` });
      if (product.stock < it.quantity) {
        return res.status(400).json({ error: `Stock insuficiente para "${product.model_name}" (stock: ${product.stock}, solicitado: ${it.quantity})` });
      }
      productCache.set(it.product_id, product);

      const unitPrice = (it.unit_price !== undefined && it.unit_price !== null) ? Number(it.unit_price) : Number(product.price);
      const unitCost  = db.calcProductCost(it.product_id);
      const lineTotal = unitPrice * it.quantity;
      const lineCost  = unitCost * it.quantity;

      subtotal += lineTotal;
      totalCost += lineCost;

      linesData.push({
        product_id: it.product_id,
        product_name: product.model_name,
        product_type: product.type,
        product_color: product.color,
        product_size: product.size,
        quantity: it.quantity,
        unit_price: unitPrice,
        unit_cost: unitCost,
        line_total: lineTotal,
        line_cost: lineCost
      });
    }

    const discountAmount = subtotal * discountPct / 100;
    const total = subtotal - discountAmount;
    const profit = total - totalCost;
    const saleNumber = db.nextSaleNumber();

    db.exec('BEGIN TRANSACTION');
    try {
      const r = db.prepare(`
        INSERT INTO sales (sale_number, customer_name, customer_doc, subtotal, discount_pct, discount_amount, total, total_cost, profit, payment_method, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        saleNumber, customer_name, customer_doc || null,
        subtotal, discountPct, discountAmount, total, totalCost, profit,
        payment_method, notes || null, req.user.id
      );
      const saleId = r.lastInsertRowid;

      const insertItem = db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, product_name, product_type, product_color, product_size, quantity, unit_price, unit_cost, line_total, line_cost)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

      for (const l of linesData) {
        insertItem.run(
          saleId, l.product_id, l.product_name, l.product_type, l.product_color, l.product_size,
          l.quantity, l.unit_price, l.unit_cost, l.line_total, l.line_cost
        );
        updateStock.run(l.quantity, l.product_id);
      }

      db.exec('COMMIT');

      const created = db.prepare(`
        SELECT s.*, u.username AS created_by_username
        FROM sales s LEFT JOIN users u ON u.id = s.created_by
        WHERE s.id = ?
      `).get(saleId);
      const itemsOut = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);

      res.status(201).json({ ...created, items: itemsOut });
    } catch (err) {
      db.exec('ROLLBACK');
      console.error('[sales] error:', err);
      res.status(500).json({ error: 'Error al registrar la venta' });
    }
  }
);

router.delete('/:id', requireAdmin, [param('id').isInt()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const id = Number(req.params.id);
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });
  if (!sale.is_active) return res.status(400).json({ error: 'La venta ya está anulada' });

  db.exec('BEGIN TRANSACTION');
  try {
    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
    const restoreStock = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
    for (const it of items) {
      if (it.product_id) restoreStock.run(it.quantity, it.product_id);
    }
    db.prepare('UPDATE sales SET is_active = 0 WHERE id = ?').run(id);
    db.exec('COMMIT');
    res.json({ ok: true, id, message: 'Venta anulada, stock restaurado' });
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('[sales] error anular:', err);
    res.status(500).json({ error: 'Error al anular la venta' });
  }
});

module.exports = router;
