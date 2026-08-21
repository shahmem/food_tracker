const express = require('express');
const router = express.Router();
const db = require('../db/init');

router.get('/', (req, res) => {
  const { count } = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN action = 'add' THEN quantity ELSE -quantity END), 0) as count FROM egg_log
  `).get();
  const log = db.prepare(`
    SELECT el.*, m.name as member_name
    FROM egg_log el LEFT JOIN members m ON el.member_id = m.id
    ORDER BY el.created_at DESC LIMIT 50
  `).all();
  res.json({ count: Math.max(0, count), log });
});

router.post('/', (req, res) => {
  const { action, quantity, member_id, notes } = req.body;
  if (!action || !quantity) return res.status(400).json({ error: 'Action and quantity are required' });

  const result = db.prepare(`INSERT INTO egg_log (action, quantity, member_id, notes) VALUES (?, ?, ?, ?)`)
    .run(action, quantity, member_id || null, notes || null);

  const entry = db.prepare(`
    SELECT el.*, m.name as member_name
    FROM egg_log el LEFT JOIN members m ON el.member_id = m.id
    WHERE el.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json(entry);
});

module.exports = router;
