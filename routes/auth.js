const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Auth } = require('../db/init');

const SALT = 'ghazal-south11-2024';

function hashPwd(pwd) {
  return crypto.createHash('sha256').update(pwd + SALT).digest('hex');
}

function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '').trim();
    const auth = await Auth.findOne({ token }).populate('member_id');
    if (!auth || !auth.member_id) return res.status(401).json({ error: 'Authentication required' });
    req.user = {
      auth_id: auth._id,
      username: auth.username,
      password: auth.password,
      member_id: auth.member_id._id,
      member_name: auth.member_id.name
    };
    next();
  } catch (e) {
    res.status(401).json({ error: 'Authentication required' });
  }
}

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const auth = await Auth.findOne({ username: username.toLowerCase().trim() }).populate('member_id');
    if (!auth || hashPwd(password) !== auth.password) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = genToken();
    auth.token = token;
    await auth.save();

    res.json({ token, member: { id: auth.member_id._id, name: auth.member_id.name } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ member: { id: req.user.member_id, name: req.user.member_name } });
});

router.post('/logout', requireAuth, async (req, res) => {
  try {
    await Auth.findByIdAndUpdate(req.user.auth_id, { token: null });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' });
    if (new_password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
    if (hashPwd(current_password) !== req.user.password) return res.status(400).json({ error: 'Current password is incorrect' });

    await Auth.findByIdAndUpdate(req.user.auth_id, { password: hashPwd(new_password) });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = { router, requireAuth, hashPwd };
