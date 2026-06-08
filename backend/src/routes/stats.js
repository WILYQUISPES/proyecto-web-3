const express = require('express');
const db = require('../config/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/overview', (req, res) => {
  const totalActivos    = db.prepare('SELECT COUNT(*) AS c FROM products WHERE is_active = 1').get().c;
  const totalEliminados = db.prepare('SELECT COUNT(*) AS c FROM products WHERE is_active = 0').get().c;
  const totalStock      = db.prepare('SELECT COALESCE(SUM(stock), 0) AS c FROM products WHERE is_active = 1').get().c;
  const valorInventario = db.prepare('SELECT COALESCE(SUM(price * stock), 0) AS c FROM products WHERE is_active = 1').get().c;
  const totalProveedores = db.prepare('SELECT COUNT(*) AS c FROM suppliers WHERE is_active = 1').get().c;
  const totalMateriales  = db.prepare('SELECT COUNT(*) AS c FROM raw_materials WHERE is_active = 1').get().c;
  const valorMatPrima    = db.prepare('SELECT COALESCE(SUM(stock * unit_cost), 0) AS c FROM raw_materials WHERE is_active = 1').get().c;
  const totalUsuarios    = db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_active = 1').get().c;
  const totalLogs        = db.prepare('SELECT COUNT(*) AS c FROM access_logs').get().c;

  const porTipo = db.prepare(`
    SELECT type AS label, COUNT(*) AS value
    FROM products WHERE is_active = 1
    GROUP BY type
    ORDER BY value DESC
  `).all();

  const stockPorMaterial = db.prepare(`
    SELECT material AS label, COALESCE(SUM(stock), 0) AS value
    FROM products WHERE is_active = 1
    GROUP BY material
    ORDER BY value DESC
  `).all();

  const ultimos7dias = db.prepare(`
    SELECT DATE(created_at) AS label, COUNT(*) AS value
    FROM products
    WHERE created_at >= datetime('now', '-7 days')
    GROUP BY DATE(created_at)
    ORDER BY label ASC
  `).all();

  const bajoStock = db.prepare(`
    SELECT id, model_name, type, color, size, stock
    FROM products
    WHERE is_active = 1 AND stock <= 5
    ORDER BY stock ASC
    LIMIT 10
  `).all();

  res.json({
    totales: {
      productosActivos: totalActivos,
      productosEliminados: totalEliminados,
      stockTotal: totalStock,
      valorInventario,
      proveedores: totalProveedores,
      materiales: totalMateriales,
      valorMatPrima,
      usuariosActivos: totalUsuarios,
      registrosLog: totalLogs
    },
    porTipo,
    stockPorMaterial,
    ultimos7dias,
    bajoStock
  });
});

module.exports = router;
