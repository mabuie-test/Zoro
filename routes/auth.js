const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email/password required' });
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'email exists' });
    const hash = await bcrypt.hash(password, 10);
    const u = new User({ email, passwordHash: hash, name });
    await u.save();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal' });
  }
});

// login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const u = await User.findOne({ email });
    if (!u) return res.status(401).json({ error: 'invalid' });
    const ok = await bcrypt.compare(password, u.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid' });
    const token = jwt.sign({ sub: u._id, email: u.email, role: u.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: u._id, email: u.email, name: u.name, role: u.role } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
