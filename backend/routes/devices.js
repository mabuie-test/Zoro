const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const License = require('../models/License');
const auth = require('../middleware/authMiddleware');

// list devices for logged user
router.get('/', auth, async (req, res) => {
  const devices = await Device.find({ ownerId: req.userId });
  res.json(devices);
});

// register a device (app calls this before activation)
router.post('/register', async (req, res) => {
  try {
    const { deviceId, label } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
    let dev = await Device.findOne({ deviceId });
    if (!dev) {
      dev = new Device({ deviceId, label, activated: false });
      await dev.save();
    } else {
      if (label) dev.label = label;
      dev.lastSeen = new Date();
      await dev.save();
    }
    res.json({ ok: true, device: dev });
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal' }); }
});

// bind device to user after license validated
router.post('/bind', auth, async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
    const dev = await Device.findOne({ deviceId });
    if (!dev) return res.status(404).json({ error: 'device not found' });
    dev.ownerId = req.userId;
    dev.activated = true;
    dev.lastSeen = new Date();
    await dev.save();
    res.json({ ok: true, device: dev });
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal' }); }
});

module.exports = router;
