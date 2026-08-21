const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db/init');

const SALT = 'ghazal-south11-2024';

function hashPwd(pwd) {
  return crypto.createHash('sha256').update(pwd + SALT).digest('hex');
}

function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getUserByToken(token) {
  if (!token) return null;
  return db.prepare(`
    SELECT a.id as auth_id, a.username, a.password, a.token, a.member_id,
           m.name as member_name
    FROM auth a JOIN members m ON a.member_id = m.id
    WHERE a.token = ?
  `).get(token);
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '').trim();
  const user = getUserByToken(token);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  req.user = user;
  next();
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const auth = db.prepare(`
    SELECT a.*, m.name as member_name
    FROM auth a JOIN members m ON a.member_id = m.id
    WHERE a.username = ?
  `).get(username.toLowerCase().trim());

  if (!auth || hashPwd(password) !== auth.password) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = genToken();
  db.prepare('UPDATE auth SET token = ? WHERE id = ?').run(token, auth.id);

  res.json({ token, member: { id: auth.member_id, name: auth.member_name } });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ member: { id: req.user.member_id, name: req.user.member_name } });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  db.prepare('UPDATE auth SET token = NULL WHERE id = ?').run(req.user.auth_id);
  res.json({ success: true });
});

// PUT /api/auth/password
router.put('/password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' });
  if (new_password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  if (hashPwd(current_password) !== req.user.password) return res.status(400).json({ error: 'Current password is incorrect' });

  db.prepare('UPDATE auth SET password = ? WHERE id = ?').run(hashPwd(new_password), req.user.auth_id);
  res.json({ success: true });
});

module.exports = { router, requireAuth, hashPwd };
