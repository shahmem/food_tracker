const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db/init');

// must match auth.js salt
function hashPwd(pwd) {
  return crypto.createHash('sha256').update(pwd + 'ghazal-south11-2024').digest('hex');
}

router.get('/', (req, res) => {
  const members = db.prepare('SELECT * FROM members ORDER BY name').all();
  res.json(members);
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    const memberId = db.transaction(() => {
      const r = db.prepare('INSERT INTO members (name) VALUES (?)').run(name.trim());
      const id = r.lastInsertRowid;
      const username = name.trim().toLowerCase().replace(/\s+/g, '');
      db.prepare('INSERT INTO auth (member_id, username, password) VALUES (?, ?, ?)')
        .run(id, username, hashPwd(`${username}@123`));
      return id;
    })();
    res.status(201).json(db.prepare('SELECT * FROM members WHERE id = ?').get(memberId));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Member already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
