const express = require('express');
const router = express.Router();
const License = require('../models/License');
const Device = require('../models/Device');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');
const crypto = require('crypto');

// generate (admin only)
router.post('/generate', auth, async (req, res) => {
  try {
    const u = await User.findById(req.userId);
    if (!u || u.role !== 'admin') return res.status(403).json({ error: 'admin only' });
    const { generatedForEmail, deviceId } = req.body;
    const key = crypto.randomBytes(12).toString('hex');
    const lic = new License({ key, generatedForEmail, deviceId, active: true });
    await lic.save();
    res.json({ ok: true, key, license: lic });
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal' }); }
});

// validate key (user)
router.post('/validate', auth, async (req, res) => {
  try {
    const { key, deviceId } = req.body;
    if (!key) return res.status(400).json({ error: 'key required' });
    const lic = await License.findOne({ key, active: true });
    if (!lic) return res.status(400).json({ error: 'invalid key' });

    // optional device binding check
    if (lic.deviceId && deviceId && lic.deviceId !== deviceId) {
      return res.status(400).json({ error: 'key not valid for this device' });
    }

    lic.usedByUserId = req.userId;
    lic.activatedAt = new Date();
    const e = new Date(); e.setMonth(e.getMonth() + 1);
    lic.expiresAt = e;
    lic.active = false; // single-use
    await lic.save();

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

// admin: list licenses
router.get('/list', auth, async (req, res) => {
  const u = await User.findById(req.userId);
  if (!u || u.role !== 'admin') return res.status(403).json({ error: 'admin only' });
  const items = await License.find().sort({ createdAt: -1 }).limit(500);
  res.json(items);
});

module.exports = router;
