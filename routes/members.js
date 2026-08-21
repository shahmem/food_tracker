const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Member, Auth } = require('../db/init');
const { requireAdmin } = require('./auth');

function hashPwd(pwd) {
  return crypto.createHash('sha256').update(pwd + 'ghazal-south11-2024').digest('hex');
}

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

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const member = await Member.create({ name: name.trim() });
    const username = name.trim().toLowerCase().replace(/\s+/g, '');
    await Auth.create({ member_id: member._id, username, password: hashPwd(`${username}@123`) });

    res.status(201).json(fmt(member));
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: 'Member already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await Member.findByIdAndDelete(req.params.id);
    await Auth.deleteOne({ member_id: req.params.id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
