const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', '..', 'data', 'pasofirme.db');
const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    ruc TEXT,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS raw_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    stock REAL NOT NULL DEFAULT 0,
    unit_cost REAL NOT NULL DEFAULT 0,
    supplier_id INTEGER,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_name TEXT NOT NULL,
    type TEXT NOT NULL,
    material TEXT NOT NULL,
    color TEXT NOT NULL,
    size INTEGER NOT NULL,
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    created_by INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS product_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    raw_material_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id),
    UNIQUE(product_id, raw_material_id)
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_doc TEXT,
    subtotal REAL NOT NULL DEFAULT 0,
    discount_pct REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    total_cost REAL NOT NULL DEFAULT 0,
    profit REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'Efectivo',
    notes TEXT,
    created_by INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    product_type TEXT,
    product_color TEXT,
    product_size INTEGER,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    unit_cost REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL,
    line_cost REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    ip TEXT,
    event TEXT NOT NULL,
    browser TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS captchas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

function calcProductCost(productId) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(pm.quantity * rm.unit_cost), 0) AS cost
    FROM product_materials pm
    JOIN raw_materials rm ON rm.id = pm.raw_material_id
    WHERE pm.product_id = ?
  `).get(productId);
  return row?.cost || 0;
}

function nextSaleNumber() {
  const row = db.prepare('SELECT sale_number FROM sales ORDER BY id DESC LIMIT 1').get();
  if (!row) return 'V-0001';
  const n = parseInt(String(row.sale_number).replace(/\D/g, ''), 10) || 0;
  return 'V-' + String(n + 1).padStart(4, '0');
}

function seed() {
  const row = db.prepare('SELECT COUNT(*) AS c FROM users').get();
  if (row.c > 0) return;

  // Usuarios
  const insertUser = db.prepare(
    'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
  );
  const adminHash = bcrypt.hashSync('Admin123!', 10);
  const userHash = bcrypt.hashSync('User1234!', 10);
  insertUser.run('admin', 'admin@pasofirme.bo', adminHash, 'admin');
  insertUser.run('usuario', 'usuario@pasofirme.bo', userHash, 'user');
  const adminId = db.prepare('SELECT id FROM users WHERE username = ?').get('admin').id;

  // Proveedores (Bolivia)
  const insertSup = db.prepare(`
    INSERT INTO suppliers (name, contact_name, phone, email, address, ruc, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertSup.run('Curtiembre San Juan',     'Roberto Vázquez',  '+591 4 4554882', 'ventas@csanjuan.com.bo', 'Av. Industrial 1244, Cochabamba',  '1023456789', 'Proveedor principal de cuero vacuno');
  insertSup.run('Textiles Andinos',         'Marta Giménez',    '+591 2 2441209', 'pedidos@andinostex.bo',  'Av. Arce 234, La Paz',             '4567890123', 'Lonas y telas técnicas');
  insertSup.run('Distribuidora Goma SRL',   'Carlos Méndez',    '+591 3 3227118', 'contacto@gomasrl.bo',    'Av. Cristo Redentor, Santa Cruz',  '5678901234', 'Suelas de goma vulcanizada');
  insertSup.run('Hilos del Sur',            'Andrea Rojas',     '+591 4 4665921', 'andrea@hilosdelsur.bo',  'Calle Junín, Cochabamba',          '6789012345', 'Hilos poliéster y nylon');
  insertSup.run('Pegamentos Premium',       'Luis Benítez',     '+591 2 2332440', 'ventas@pegamentos.bo',   'Zona Sur, La Paz',                 '7890123456', 'Adhesivos PU para calzado');
  insertSup.run('Accesorios y Plantillas',  'Sofía Martínez',   '+591 3 3889110', 'info@accplantillas.bo',  'Equipetrol, Santa Cruz',           '8901234567', 'Cordones, hebillas, plantillas');

  // Materias primas (precios en Bs Bolivianos)
  const insertMat = db.prepare(`
    INSERT INTO raw_materials (name, unit, stock, unit_cost, supplier_id, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertMat.run('Cuero vacuno negro',       'm²',       45.0,  280, 1, 'Cuero curtido de primera calidad');
  insertMat.run('Cuero vacuno marrón',      'm²',       38.5,  280, 1, 'Cuero curtido tono marrón');
  insertMat.run('Cuero vacuno cognac',      'm²',       22.0,  310, 1, 'Cuero tono cognac envejecido');
  insertMat.run('Gamuza camel',             'm²',       28.0,  260, 1, 'Gamuza suave tono camel');
  insertMat.run('Lona algodón blanca',      'm',        120.0, 95,  2, 'Lona reforzada para zapatillas');
  insertMat.run('Tela técnica deportiva',   'm',        85.0,  120, 2, 'Tela transpirable para sneakers');
  insertMat.run('Suela goma vulcanizada',   'par',      180,   150, 3, 'Suela antideslizante 8mm');
  insertMat.run('Suela cuero suela',        'par',      90,    220, 3, 'Suela de cuero para zapatos formales');
  insertMat.run('Hilo poliéster negro',     'carrete',  60,    40,  4, 'Carrete 5000m, alta resistencia');
  insertMat.run('Hilo poliéster marrón',    'carrete',  45,    40,  4, 'Carrete 5000m, alta resistencia');
  insertMat.run('Pegamento PU industrial',  'litro',    32.0,  130, 5, 'Adhesivo poliuretano 1L');
  insertMat.run('Cordones cuero (par)',     'par',      220,   25,  6, 'Cordones cuero encerado 80cm');
  insertMat.run('Plantilla EVA acolchada',  'par',      150,   50,  6, 'Plantilla anatómica');
  insertMat.run('Caja calzado premium',     'unidad',   300,   20,  6, 'Caja cartón laminado con logo');

  // Productos
  const insertProd = db.prepare(`
    INSERT INTO products (model_name, type, material, color, size, price, stock, description, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertProd.run('Oxford Clásico',  'Zapato',    'Cuero',     'Negro',     42, 850,  18, 'Zapato de vestir con cordones, suela de cuero.', adminId);
  insertProd.run('Bota Texana',     'Bota',      'Cuero',     'Marrón',    40, 1200, 9,  'Bota estilo texano con caña media y bordados.', adminId);
  insertProd.run('Botín Urbano',    'Botín',     'Gamuza',    'Camel',     38, 920,  12, 'Botín casual con cordones y suela de goma.', adminId);
  insertProd.run('Sneaker Runner',  'Zapatilla', 'Tela',      'Blanco',    41, 580,  30, 'Zapatilla deportiva ligera para correr.', adminId);
  insertProd.run('Mocasín Penny',   'Mocasín',   'Cuero',     'Borgoña',   43, 790,  3,  'Mocasín clásico estilo penny loafer.', adminId);
  insertProd.run('Sandalia Verano', 'Sandalia',  'Sintético', 'Beige',     37, 320,  25, 'Sandalia ligera para clima cálido.', adminId);
  insertProd.run('Bota Trekking',   'Bota',      'Cuero',     'Negro',     43, 1100, 4,  'Bota impermeable con suela Vibram.', adminId);
  insertProd.run('Zapatilla Skate', 'Zapatilla', 'Lona',      'Gris',      40, 540,  22, 'Zapatilla baja para skate, suela vulcanizada.', adminId);
  insertProd.run('Oxford Brogue',   'Zapato',    'Cuero',     'Cognac',    41, 960,  2,  'Oxford con perforaciones decorativas brogue.', adminId);
  insertProd.run('Botín Chelsea',   'Botín',     'Gamuza',    'Azul',      42, 880,  14, 'Botín Chelsea con elásticos laterales.', adminId);

  // Composición
  const insertPM = db.prepare(`INSERT INTO product_materials (product_id, raw_material_id, quantity) VALUES (?, ?, ?)`);
  insertPM.run(1, 1, 0.45); insertPM.run(1, 8, 1); insertPM.run(1, 9, 0.05); insertPM.run(1, 11, 0.08); insertPM.run(1, 13, 1); insertPM.run(1, 14, 1);
  insertPM.run(2, 2, 0.85); insertPM.run(2, 8, 1); insertPM.run(2, 10, 0.10); insertPM.run(2, 11, 0.12); insertPM.run(2, 13, 1); insertPM.run(2, 14, 1);
  insertPM.run(3, 4, 0.55); insertPM.run(3, 7, 1); insertPM.run(3, 10, 0.06); insertPM.run(3, 11, 0.08); insertPM.run(3, 12, 1); insertPM.run(3, 13, 1); insertPM.run(3, 14, 1);
  insertPM.run(4, 6, 0.60); insertPM.run(4, 7, 1); insertPM.run(4, 9, 0.05); insertPM.run(4, 11, 0.10); insertPM.run(4, 12, 1); insertPM.run(4, 13, 1); insertPM.run(4, 14, 1);
  insertPM.run(5, 3, 0.40); insertPM.run(5, 8, 1); insertPM.run(5, 10, 0.04); insertPM.run(5, 11, 0.06); insertPM.run(5, 13, 1); insertPM.run(5, 14, 1);
  insertPM.run(6, 7, 1); insertPM.run(6, 9, 0.03); insertPM.run(6, 11, 0.05); insertPM.run(6, 14, 1);
  insertPM.run(7, 1, 0.90); insertPM.run(7, 7, 1); insertPM.run(7, 9, 0.12); insertPM.run(7, 11, 0.15); insertPM.run(7, 12, 1); insertPM.run(7, 13, 1); insertPM.run(7, 14, 1);
  insertPM.run(8, 5, 0.70); insertPM.run(8, 7, 1); insertPM.run(8, 9, 0.06); insertPM.run(8, 11, 0.10); insertPM.run(8, 12, 1); insertPM.run(8, 13, 1); insertPM.run(8, 14, 1);
  insertPM.run(9, 3, 0.50); insertPM.run(9, 8, 1); insertPM.run(9, 10, 0.07); insertPM.run(9, 11, 0.08); insertPM.run(9, 13, 1); insertPM.run(9, 14, 1);
  insertPM.run(10, 4, 0.60); insertPM.run(10, 7, 1); insertPM.run(10, 9, 0.06); insertPM.run(10, 11, 0.08); insertPM.run(10, 13, 1); insertPM.run(10, 14, 1);

  // Ventas de ejemplo (fechas distribuidas)
  const insertSale = db.prepare(`
    INSERT INTO sales (sale_number, customer_name, customer_doc, subtotal, discount_pct, discount_amount, total, total_cost, profit, payment_method, notes, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);
  const insertSaleItem = db.prepare(`
    INSERT INTO sale_items (sale_id, product_id, product_name, product_type, product_color, product_size, quantity, unit_price, unit_cost, line_total, line_cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sampleSales = [
    { date: '-25 days', customer: 'Juan Pérez Mamani',     doc: '3456789 CB', method: 'Efectivo',      items: [[1, 1]], discount: 0 },
    { date: '-22 days', customer: 'María González Choque', doc: '4123567 LP', method: 'Transferencia', items: [[3, 1]], discount: 5 },
    { date: '-18 days', customer: 'Carlos Rodríguez',      doc: '2890123 SC', method: 'Tarjeta',       items: [[2, 1], [4, 2]], discount: 10 },
    { date: '-15 days', customer: 'Ana Sánchez',           doc: '5234890 CB', method: 'Efectivo',      items: [[6, 2]], discount: 0 },
    { date: '-12 days', customer: 'Luis Fernández',        doc: '3987654 LP', method: 'Transferencia', items: [[8, 1], [4, 1]], discount: 0 },
    { date: '-10 days', customer: 'Sofía Ramírez',         doc: null,         method: 'Efectivo',      items: [[5, 1]], discount: 15 },
    { date: '-8 days',  customer: 'Pedro López Quispe',    doc: '4567234 SC', method: 'Tarjeta',       items: [[9, 1]], discount: 0 },
    { date: '-6 days',  customer: 'Laura Martínez',        doc: '3345123 CB', method: 'Transferencia', items: [[10, 1], [3, 1]], discount: 5 },
    { date: '-4 days',  customer: 'Roberto Díaz',          doc: '4789567 LP', method: 'Efectivo',      items: [[7, 1]], discount: 0 },
    { date: '-2 days',  customer: 'Verónica Acosta',       doc: null,         method: 'Tarjeta',       items: [[1, 2], [4, 1]], discount: 8 },
    { date: '-1 days',  customer: 'Diego Benítez',         doc: '5456789 SC', method: 'Efectivo',      items: [[8, 1]], discount: 0 },
    { date: '-0 days',  customer: 'Patricia Vera Chávez',  doc: '3234567 CB', method: 'Transferencia', items: [[6, 1], [4, 1]], discount: 0 }
  ];

  let saleN = 1;
  for (const s of sampleSales) {
    const validItems = s.items.filter((it) => it[1] > 0);
    let subtotal = 0; let totalCost = 0;
    const lines = [];
    for (const [pid, qty] of validItems) {
      const p = db.prepare('SELECT * FROM products WHERE id = ?').get(pid);
      if (!p) continue;
      const unitCost = calcProductCost(pid);
      const lineTotal = p.price * qty;
      const lineCost = unitCost * qty;
      subtotal += lineTotal;
      totalCost += lineCost;
      lines.push({
        pid, name: p.model_name, type: p.type, color: p.color, size: p.size,
        qty, unit_price: p.price, unit_cost: unitCost, line_total: lineTotal, line_cost: lineCost
      });
    }
    const discPct = s.discount;
    const discAmt = subtotal * discPct / 100;
    const total = subtotal - discAmt;
    const profit = total - totalCost;
    const num = 'V-' + String(saleN++).padStart(4, '0');
    const r = insertSale.run(num, s.customer, s.doc, subtotal, discPct, discAmt, total, totalCost, profit, s.method, null, adminId, s.date);
    for (const l of lines) {
      insertSaleItem.run(r.lastInsertRowid, l.pid, l.name, l.type, l.color, l.size, l.qty, l.unit_price, l.unit_cost, l.line_total, l.line_cost);
      db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?').run(l.qty, l.pid);
    }
  }

  console.log('[db] Seed: 2 usuarios + 6 proveedores + 14 materias + 10 productos + 12 ventas');
}

seed();

setInterval(() => {
  try {
    db.prepare('DELETE FROM captchas WHERE expires_at < ?').run(Date.now());
  } catch (_) {}
}, 60_000);

db.calcProductCost = calcProductCost;
db.nextSaleNumber = nextSaleNumber;
module.exports = db;
