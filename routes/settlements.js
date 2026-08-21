const express = require('express');
const router = express.Router();
const db = require('../db/init');

function getBalances() {
  const members = db.prepare('SELECT * FROM members ORDER BY name').all();
  const balances = {};
  members.forEach(m => (balances[m.id] = 0));

  const splits = db.prepare(`
    SELECT bs.member_id, bs.amount, b.paid_by
    FROM bill_splits bs JOIN bills b ON bs.bill_id = b.id
  `).all();
  for (const s of splits) {
    if (s.paid_by !== s.member_id) {
      balances[s.paid_by] = (balances[s.paid_by] || 0) + s.amount;
      balances[s.member_id] = (balances[s.member_id] || 0) - s.amount;
    }
  }

  const tracked = db.prepare(`
    SELECT tl.*, ti.price_per_unit as default_price
    FROM tracked_log tl JOIN tracked_items ti ON tl.item_id = ti.id
    WHERE tl.action = 'add' AND tl.paid_by IS NOT NULL AND tl.split_members IS NOT NULL
  `).all();
  for (const t of tracked) {
    const price = t.price_per_unit != null ? t.price_per_unit : t.default_price;
    const total = t.quantity * price;
    const split = JSON.parse(t.split_members);
    if (split.length === 0) continue;
    const share = total / split.length;
    for (const memberId of split) {
      if (memberId !== t.paid_by) {
        balances[t.paid_by] = (balances[t.paid_by] || 0) + share;
        balances[memberId] = (balances[memberId] || 0) - share;
      }
    }
  }

  const settled = db.prepare('SELECT * FROM settlements').all();
  for (const s of settled) {
    balances[s.from_member_id] = (balances[s.from_member_id] || 0) + s.amount;
    balances[s.to_member_id] = (balances[s.to_member_id] || 0) - s.amount;
  }

  return { members, balances };
}

router.get('/summary', (req, res) => {
  const { members, balances } = getBalances();
  const memberBalances = members.map(m => ({ ...m, balance: Math.round((balances[m.id] || 0) * 100) / 100 }));

  const creditors = memberBalances.filter(m => m.balance > 0.01).map(m => ({ ...m }));
  const debtors = memberBalances.filter(m => m.balance < -0.01).map(m => ({ ...m, balance: -m.balance }));
  creditors.sort((a, b) => b.balance - a.balance);
  debtors.sort((a, b) => b.balance - a.balance);

  const transactions = [];
  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const amount = Math.min(creditors[i].balance, debtors[j].balance);
    if (amount > 0.01) transactions.push({ from_id: debtors[j].id, from: debtors[j].name, to_id: creditors[i].id, to: creditors[i].name, amount: Math.round(amount * 100) / 100 });
    creditors[i].balance -= amount;
    debtors[j].balance -= amount;
    if (creditors[i].balance < 0.01) i++;
    if (debtors[j].balance < 0.01) j++;
  }

  res.json({ memberBalances, transactions });
});

router.get('/history', (req, res) => {
  const history = db.prepare(`
    SELECT s.*, fm.name as from_name, tm.name as to_name
    FROM settlements s
    JOIN members fm ON s.from_member_id = fm.id
    JOIN members tm ON s.to_member_id = tm.id
    ORDER BY s.created_at DESC LIMIT 100
  `).all();
  res.json(history);
});

router.post('/', (req, res) => {
  const from_member_id = req.user.member_id; // always logged-in user
  const { to_member_id, amount, date, notes } = req.body;
  if (!to_member_id || !amount) return res.status(400).json({ error: 'to_member_id and amount required' });
  if (from_member_id === to_member_id) return res.status(400).json({ error: 'Cannot settle with yourself' });

  const result = db.prepare(`INSERT INTO settlements (from_member_id, to_member_id, amount, date, notes) VALUES (?, ?, ?, ?, ?)`)
    .run(from_member_id, to_member_id, amount, date || new Date().toISOString().split('T')[0], notes || null);

  const settlement = db.prepare(`
    SELECT s.*, fm.name as from_name, tm.name as to_name
    FROM settlements s JOIN members fm ON s.from_member_id = fm.id JOIN members tm ON s.to_member_id = tm.id
    WHERE s.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json(settlement);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM settlements WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
