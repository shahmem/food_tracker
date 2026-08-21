const express = require('express');
const router = express.Router();
const db = require('../db/init');

function withDetails(bill) {
  bill.items = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(bill.id);
  bill.splits = db.prepare(`
    SELECT bs.*, m.name as member_name
    FROM bill_splits bs JOIN members m ON bs.member_id = m.id
    WHERE bs.bill_id = ?
  `).all(bill.id);
  return bill;
}

router.get('/', (req, res) => {
  const { type } = req.query;
  const bills = type
    ? db.prepare(`SELECT b.*, m.name as payer_name FROM bills b LEFT JOIN members m ON b.paid_by = m.id WHERE b.type = ? ORDER BY b.date DESC, b.id DESC`).all(type)
    : db.prepare(`SELECT b.*, m.name as payer_name FROM bills b LEFT JOIN members m ON b.paid_by = m.id ORDER BY b.date DESC, b.id DESC`).all();
  res.json(bills.map(withDetails));
});

router.post('/', (req, res) => {
  const { type, description, total_amount, date, items, splits } = req.body;
  const paid_by = req.user.member_id; // always the logged-in user

  if (!type || !total_amount) return res.status(400).json({ error: 'type and total_amount required' });
  if (!splits || splits.length === 0) return res.status(400).json({ error: 'At least one split required' });

  try {
    const billId = db.transaction(() => {
      const r = db.prepare(`INSERT INTO bills (type, description, total_amount, paid_by, date) VALUES (?, ?, ?, ?, ?)`)
        .run(type, description?.trim() || '', total_amount, paid_by, date || new Date().toISOString().split('T')[0]);

      const billId = r.lastInsertRowid;

      if (items?.length > 0) {
        const ins = db.prepare(`INSERT INTO bill_items (bill_id, name, quantity, unit, amount) VALUES (?, ?, ?, ?, ?)`);
        for (const item of items) ins.run(billId, item.name, item.quantity || null, item.unit || null, item.amount);
      }

      const insSplit = db.prepare(`INSERT INTO bill_splits (bill_id, member_id, amount) VALUES (?, ?, ?)`);
      for (const s of splits) insSplit.run(billId, s.member_id, s.amount);

      return billId;
    })();

    const bill = db.prepare(`SELECT b.*, m.name as payer_name FROM bills b LEFT JOIN members m ON b.paid_by = m.id WHERE b.id = ?`).get(billId);
    res.status(201).json(withDetails(bill));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM bills WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
