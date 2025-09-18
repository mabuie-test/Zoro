const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const auth = require('../middleware/authMiddleware');

// list devices for logged user
router.get('/', auth, async (req, res) => {
  const devices = await Device.find({ ownerId: req.userId });
  res.json(devices);
});

// register device (called by app)
router.post('/register', async (req, res) => {
  try {
    const { deviceId, label } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
    let dev = await Device.findOne({ deviceId });
    if (!dev) {
      dev = new Device({ deviceId, label, activated: false });
    } else {
      if (label) dev.label = label;
      dev.lastSeen = new Date();
    }
    await dev.save();
    res.json({ ok: true, device: dev });
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal' }); }
});

// bind device to user after license validated (auth required)
router.post('/bind', auth, async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
    let dev = await Device.findOne({ deviceId });
    if (!dev) {
      dev = new Device({ deviceId, ownerId: req.userId, activated: true, lastSeen: new Date() });
    } else {
      dev.ownerId = req.userId;
      dev.activated = true;
      dev.lastSeen = new Date();
    }
    await dev.save();
    res.json({ ok: true, device: dev });
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal' }); }
});

module.exports = router;
