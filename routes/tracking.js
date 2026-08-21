const express = require('express');
const router = express.Router();
const db = require('../db/init');

router.get('/', (req, res) => {
  const items = db.prepare('SELECT * FROM tracked_items ORDER BY name').all();
  for (const item of items) {
    const { stock } = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN action='add' THEN quantity ELSE -quantity END), 0) as stock
      FROM tracked_log WHERE item_id = ?
    `).get(item.id);
    item.current_stock = Math.max(0, stock);
    item.recent_log = db.prepare(`
      SELECT tl.*, m.name as member_name, p.name as paid_by_name
      FROM tracked_log tl
      LEFT JOIN members m ON tl.member_id = m.id
      LEFT JOIN members p ON tl.paid_by = p.id
      WHERE tl.item_id = ? ORDER BY tl.created_at DESC LIMIT 10
    `).all(item.id);
  }
  res.json(items);
});

router.post('/items', (req, res) => {
  const { name, unit, price_per_unit } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    const r = db.prepare(`INSERT INTO tracked_items (name, unit, price_per_unit) VALUES (?, ?, ?)`)
      .run(name.trim(), unit || 'pieces', price_per_unit || 0);
    res.status(201).json(db.prepare('SELECT * FROM tracked_items WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Item already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/items/:id', (req, res) => {
  db.prepare('DELETE FROM tracked_items WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/log', (req, res) => {
  const { item_id, action, quantity, split_members, price_per_unit, notes, date } = req.body;
  if (!item_id || !action || !quantity) return res.status(400).json({ error: 'item_id, action, quantity required' });

  // paid_by and member_id are always the logged-in user
  const paid_by = action === 'add' ? req.user.member_id : null;
  const member_id = action === 'use' ? req.user.member_id : null;

  const result = db.prepare(`
    INSERT INTO tracked_log (item_id, action, quantity, member_id, paid_by, split_members, price_per_unit, notes, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    item_id, action, quantity,
    member_id,
    paid_by,
    split_members ? JSON.stringify(split_members) : null,
    price_per_unit != null ? price_per_unit : null,
    notes || null,
    date || new Date().toISOString().split('T')[0]
  );

  const entry = db.prepare(`
    SELECT tl.*, m.name as member_name, p.name as paid_by_name
    FROM tracked_log tl
    LEFT JOIN members m ON tl.member_id = m.id
    LEFT JOIN members p ON tl.paid_by = p.id
    WHERE tl.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json(entry);
});

module.exports = router;
