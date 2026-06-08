const express = require('express');
const db = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');

const router = express.Router();

router.use(verifyToken, requireAdmin);

function sumPeriod(daysFrom) {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(total), 0)   AS total,
      COALESCE(SUM(profit), 0)  AS profit,
      COALESCE(SUM(total_cost), 0) AS cost,
      COUNT(*) AS count
    FROM sales
    WHERE is_active = 1 AND created_at >= datetime('now', ?)
  `).get(daysFrom);
  return {
    total:  row.total  || 0,
    profit: row.profit || 0,
    cost:   row.cost   || 0,
    count:  row.count  || 0
  };
}

router.get('/summary', (req, res) => {
  const today  = sumPeriod('-1 days');
  const week   = sumPeriod('-7 days');
  const month  = sumPeriod('-30 days');
  const year   = sumPeriod('-365 days');
  const all    = sumPeriod('-9999 days');

  const valorMatPrima = db.prepare(`
    SELECT COALESCE(SUM(stock * unit_cost), 0) AS v FROM raw_materials WHERE is_active = 1
  `).get().v || 0;

  const inversionMatPrima = db.prepare(`
    SELECT COALESCE(SUM(sale_items.line_cost), 0) AS v
    FROM sale_items
    JOIN sales ON sales.id = sale_items.sale_id
    WHERE sales.is_active = 1
  `).get().v || 0;

  const marginAvg = all.total > 0 ? (all.profit / all.total) * 100 : 0;

  const ventasPorMes = db.prepare(`
    SELECT
      strftime('%Y-%m', created_at) AS label,
      COALESCE(SUM(total), 0)  AS ventas,
      COALESCE(SUM(profit), 0) AS ganancias,
      COUNT(*) AS cantidad
    FROM sales
    WHERE is_active = 1 AND created_at >= datetime('now', '-12 months')
    GROUP BY label
    ORDER BY label ASC
  `).all();

  const topProductos = db.prepare(`
    SELECT
      product_name AS label,
      SUM(quantity) AS unidades,
      SUM(line_total) AS ventas,
      SUM(line_cost)  AS costo,
      SUM(line_total - line_cost) AS ganancia
    FROM sale_items
    JOIN sales ON sales.id = sale_items.sale_id
    WHERE sales.is_active = 1
    GROUP BY product_name
    ORDER BY ventas DESC
    LIMIT 5
  `).all();

  const ventasPorMetodo = db.prepare(`
    SELECT payment_method AS label, COUNT(*) AS cantidad, SUM(total) AS ventas
    FROM sales
    WHERE is_active = 1
    GROUP BY payment_method
    ORDER BY ventas DESC
  `).all();

  res.json({
    periodos: { today, week, month, year, all },
    valorMatPrima,
    inversionMatPrima,
    marginAvg,
    ventasPorMes,
    topProductos,
    ventasPorMetodo
  });
});

module.exports = router;
