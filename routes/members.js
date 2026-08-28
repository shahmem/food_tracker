const express = require('express');
const router = express.Router();
const { Member } = require('../db/init');

function fmt(m) {
  return { id: m._id, name: m.name, created_at: m.created_at };
}

router.get('/', async (req, res) => {
  try {
    const members = await Member.find().sort('name');
    res.json(members.map(fmt));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const member = await Member.create({ name: name.trim() });
    res.status(201).json(fmt(member));
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: 'Member already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Member.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
