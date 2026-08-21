const express = require('express');
const router = express.Router();
const { Bill } = require('../db/init');

function fmt(b) {
  return {
    id: b._id,
    type: b.type,
    description: b.description,
    total_amount: b.total_amount,
    paid_by: b.paid_by?._id ?? b.paid_by,
    payer_name: b.paid_by?.name,
    date: b.date,
    created_at: b.created_at,
    items: b.items,
    splits: b.splits.map(s => ({
      id: s._id,
      member_id: s.member_id?._id ?? s.member_id,
      member_name: s.member_id?.name,
      amount: s.amount
    }))
  };
}

router.get('/', async (req, res) => {
  try {
    const filter = req.query.type ? { type: req.query.type } : {};
    const bills = await Bill.find(filter)
      .populate('paid_by', 'name')
      .populate('splits.member_id', 'name')
      .sort({ date: -1, _id: -1 });
    res.json(bills.map(fmt));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { type, description, total_amount, date, items, splits } = req.body;
    if (!type || !total_amount) return res.status(400).json({ error: 'type and total_amount required' });
    if (!splits || splits.length === 0) return res.status(400).json({ error: 'At least one split required' });

    const bill = await Bill.create({
      type,
      description: description?.trim() || '',
      total_amount,
      paid_by: req.user.member_id,
      date: date || new Date().toISOString().split('T')[0],
      items: items || [],
      splits
    });

    const populated = await bill.populate(['paid_by', { path: 'splits.member_id', select: 'name' }]);
    res.status(201).json(fmt(populated));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Bill.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
