const express = require('express');
const router = express.Router();
const { TrackedItem, TrackedLog } = require('../db/init');

function fmtLog(l) {
  return {
    id: l._id,
    item_id: l.item_id,
    action: l.action,
    quantity: l.quantity,
    member_id: l.member_id?._id ?? l.member_id,
    member_name: l.member_id?.name,
    paid_by: l.paid_by?._id ?? l.paid_by,
    paid_by_name: l.paid_by?.name,
    split_members: l.split_members,
    price_per_unit: l.price_per_unit,
    notes: l.notes,
    date: l.date,
    created_at: l.created_at
  };
}

router.get('/', async (req, res) => {
  try {
    const items = await TrackedItem.find().sort('name').lean();
    for (const item of items) {
      const logs = await TrackedLog.find({ item_id: item._id });
      const stock = logs.reduce((sum, l) => sum + (l.action === 'add' ? l.quantity : -l.quantity), 0);
      item.current_stock = Math.max(0, stock);
      item.id = item._id;

      const recent = await TrackedLog.find({ item_id: item._id })
        .populate('member_id', 'name')
        .populate('paid_by', 'name')
        .sort({ created_at: -1 })
        .limit(10);
      item.recent_log = recent.map(fmtLog);
    }
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/items', async (req, res) => {
  try {
    const { name, unit, price_per_unit } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const item = await TrackedItem.create({ name: name.trim(), unit: unit || 'pieces', price_per_unit: price_per_unit || 0 });
    res.status(201).json({ id: item._id, name: item.name, unit: item.unit, price_per_unit: item.price_per_unit });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: 'Item already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/items/:id', async (req, res) => {
  try {
    const { name, unit, price_per_unit } = req.body;
    const update = {};
    if (name?.trim()) update.name = name.trim();
    if (unit?.trim()) update.unit = unit.trim();
    if (price_per_unit != null) update.price_per_unit = price_per_unit;
    const item = await TrackedItem.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json({ id: item._id, name: item.name, unit: item.unit, price_per_unit: item.price_per_unit });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: 'Item name already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/items/:id', async (req, res) => {
  try {
    await TrackedItem.findByIdAndDelete(req.params.id);
    await TrackedLog.deleteMany({ item_id: req.params.id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const logs = await TrackedLog.find()
      .populate('item_id', 'name unit')
      .populate('member_id', 'name')
      .populate('paid_by', 'name')
      .sort({ created_at: -1 })
      .limit(200);
    res.json(logs.map(l => ({
      ...fmtLog(l),
      item_name: l.item_id?.name,
      item_unit: l.item_id?.unit
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/log', async (req, res) => {
  try {
    const { item_id, action, quantity, split_members, price_per_unit, notes, date } = req.body;
    if (!item_id || !action || !quantity) return res.status(400).json({ error: 'item_id, action, quantity required' });

    const { member_id: member_id_body } = req.body;
    if (!member_id_body) return res.status(400).json({ error: 'member_id required' });

    const entry = await TrackedLog.create({
      item_id,
      action,
      quantity,
      member_id: action === 'use' ? member_id_body : null,
      paid_by: action === 'add' ? member_id_body : null,
      split_members: split_members || [],
      price_per_unit: price_per_unit ?? null,
      notes: notes || null,
      date: date || new Date().toISOString().split('T')[0]
    });

    const populated = await entry.populate([{ path: 'member_id', select: 'name' }, { path: 'paid_by', select: 'name' }]);
    res.status(201).json(fmtLog(populated));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
