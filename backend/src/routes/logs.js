const express = require('express');
const { query, validationResult } = require('express-validator');

const db = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');

const router = express.Router();

router.use(verifyToken, requireAdmin);

router.get(
  '/',
  [
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
    query('event').optional().isString().trim()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const limit = req.query.limit || 200;
    const event = req.query.event;
    let sql = 'SELECT * FROM access_logs';
    const params = [];
    if (event) {
      sql += ' WHERE event = ?';
      params.push(event);
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    res.json(db.prepare(sql).all(...params));
  }
);

module.exports = router;
