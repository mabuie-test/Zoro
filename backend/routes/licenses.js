const express = require('express');
const router = express.Router();
const License = require('../models/License');
const Device = require('../models/Device');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');
const crypto = require('crypto');

// Admin: generate key (protected for admin role).
// For simplicity in this scaffold we check req.userId and user.role manually in admin route registration
router.post('/generate', auth, async (req, res) => {
  try {
    // only admin users allowed: fetch user role
    const u = await User.findById(req.userId);
    if (!u || u.role !== 'admin') return res.status(403).json({ error: 'admin only' });

    const { generatedForEmail, deviceId } = req.body;
    // generate secure key
    const key = crypto.randomBytes(12).toString('hex'); // 24 chars
    const expiresAt = null; // not active until consumed
    const lic = new License({ key, generatedForEmail, deviceId, active: true });
    await lic.save();
    res.json({ ok: true, key, license: lic });
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal' }); }
});

// Validate key when user inserts into system (binds to user and set expiresAt = now + 1 month)
router.post('/validate', auth, async (req, res) => {
  try {
    const { key, deviceId } = req.body;
    if (!key) return res.status(400).json({ error: 'key required' });
    const lic = await License.findOne({ key, active: true });
    if (!lic) return res.status(400).json({ error: 'invalid key' });

    // optionally check deviceId matches license.deviceId when admin pre-bound in generation
    if (lic.deviceId && deviceId && lic.deviceId !== deviceId) {
      return res.status(400).json({ error: 'key not valid for this device' });
    }

    // activate license: set usedByUserId and expiresAt
    lic.usedByUserId = req.userId;
    lic.activatedAt = new Date();
    const e = new Date();
    e.setMonth(e.getMonth() + 1);
    lic.expiresAt = e;
    lic.active = false; // single-use
    await lic.save();

    // if deviceId provided, bind device to user and mark activated
    if (deviceId) {
      let dev = await Device.findOne({ deviceId });
      if (!dev) {
        dev = new Device({ deviceId, ownerId: req.userId, activated: true, lastSeen: new Date() });
      } else {
        dev.ownerId = req.userId;
        dev.activated = true;
        dev.lastSeen = new Date();
      }
      await dev.save();
    }

    res.json({ ok: true, message: 'license validated', expiresAt: lic.expiresAt });
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal' }); }
});

// admin route: list keys
router.get('/list', auth, async (req, res) => {
  const u = await User.findById(req.userId);
  if (!u || u.role !== 'admin') return res.status(403).json({ error: 'admin only' });
  const items = await License.find().sort({ createdAt: -1 }).limit(500);
  res.json(items);
});

module.exports = router;
