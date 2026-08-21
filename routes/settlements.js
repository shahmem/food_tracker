const express = require('express');
const router = express.Router();
const { Member, Bill, TrackedLog, Settlement } = require('../db/init');

async function getBalances() {
  const members = await Member.find().sort('name');
  const balances = {};
  members.forEach(m => (balances[m._id.toString()] = 0));

  const bills = await Bill.find().select('paid_by splits');
  for (const bill of bills) {
    const paidBy = bill.paid_by.toString();
    for (const split of bill.splits) {
      const memberId = split.member_id.toString();
      if (paidBy !== memberId) {
        balances[paidBy] = (balances[paidBy] || 0) + split.amount;
        balances[memberId] = (balances[memberId] || 0) - split.amount;
      }
    }
  }

  const tracked = await TrackedLog.find({ action: 'add', paid_by: { $ne: null } }).populate('item_id', 'price_per_unit');
  for (const t of tracked) {
    if (!t.split_members || t.split_members.length === 0) continue;
    const price = t.price_per_unit != null ? t.price_per_unit : t.item_id?.price_per_unit ?? 0;
    const share = (t.quantity * price) / t.split_members.length;
    const paidBy = t.paid_by.toString();
    for (const memberId of t.split_members) {
      const mId = memberId.toString();
      if (mId !== paidBy) {
        balances[paidBy] = (balances[paidBy] || 0) + share;
        balances[mId] = (balances[mId] || 0) - share;
      }
    }
  }

  const settled = await Settlement.find();
  for (const s of settled) {
    balances[s.from_member_id.toString()] = (balances[s.from_member_id.toString()] || 0) + s.amount;
    balances[s.to_member_id.toString()] = (balances[s.to_member_id.toString()] || 0) - s.amount;
  }

  return { members, balances };
}

router.get('/summary', async (req, res) => {
  try {
    const { members, balances } = await getBalances();
    const memberBalances = members.map(m => ({
      id: m._id,
      name: m.name,
      balance: Math.round((balances[m._id.toString()] || 0) * 100) / 100
    }));

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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const history = await Settlement.find()
      .populate('from_member_id', 'name')
      .populate('to_member_id', 'name')
      .sort({ created_at: -1 })
      .limit(100);
    res.json(history.map(s => ({
      id: s._id,
      from_member_id: s.from_member_id._id,
      from_name: s.from_member_id.name,
      to_member_id: s.to_member_id._id,
      to_name: s.to_member_id.name,
      amount: s.amount,
      date: s.date,
      notes: s.notes,
      created_at: s.created_at
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const from_member_id = req.user.member_id;
    const { to_member_id, amount, date, notes } = req.body;
    if (!to_member_id || !amount) return res.status(400).json({ error: 'to_member_id and amount required' });
    if (from_member_id.toString() === to_member_id.toString()) return res.status(400).json({ error: 'Cannot settle with yourself' });

    const s = await Settlement.create({ from_member_id, to_member_id, amount, date: date || new Date().toISOString().split('T')[0], notes: notes || null });
    const populated = await s.populate(['from_member_id', 'to_member_id']);
    res.status(201).json({
      id: populated._id,
      from_member_id: populated.from_member_id._id,
      from_name: populated.from_member_id.name,
      to_member_id: populated.to_member_id._id,
      to_name: populated.to_member_id.name,
      amount: populated.amount,
      date: populated.date,
      notes: populated.notes,
      created_at: populated.created_at
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Settlement.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
