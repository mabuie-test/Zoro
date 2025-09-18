// routes/admin.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const SETUP_KEY = process.env.SETUP_KEY || null;

/**
 * POST /api/admin/create
 * Body: { key: "<setup-key>", email, password, name? }
 *
 * Regras:
 * - Só funciona se process.env.SETUP_KEY estiver definido e bater com `key` enviado.
 * - Cria um novo user (email lowercased) ou atualiza o existente.
 * - Faz role = 'admin' e devolve um JWT para login imediato.
 */
router.post('/create', async (req, res) => {
  try {
    if (!SETUP_KEY) return res.status(403).json({ error: 'admin setup disabled (SETUP_KEY not configured)' });

    const { key, email, password, name } = req.body;
    if (!key || key !== SETUP_KEY) return res.status(403).json({ error: 'invalid setup key' });
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const emailNorm = String(email).trim().toLowerCase();
    const hash = await bcrypt.hash(password, 10);

    let user = await User.findOne({ email: emailNorm });
    if (user) {
      user.passwordHash = hash;
      user.name = name || user.name;
      user.role = 'admin';
      await user.save();
    } else {
      user = new User({
        email: emailNorm,
        passwordHash: hash,
        name: name || 'Admin',
        role: 'admin'
      });
      await user.save();
    }

    // return JWT for convenience
    const token = jwt.sign({ sub: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

    return res.json({
      ok: true,
      message: 'admin created/updated',
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
      token
    });
  } catch (err) {
    console.error('admin create error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
