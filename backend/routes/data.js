const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');

const Location = require('../models/Location');
const Sms = require('../models/Sms');
const Call = require('../models/Call');

// POST location (from device) - device authenticates using token of user (app should include Authorization header)
router.post('/location', auth, async (req, res) => {
  try {
    const { deviceId, lat, lon, accuracy, timestamp } = req.body;
    if (!deviceId || lat === undefined || lon === undefined) return res.status(400).json({ error: 'invalid' });
    const loc = new Location({
      deviceId, ownerId: req.userId, lat, lon, accuracy,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });
    await loc.save();
    // emit via socket.io if present
    if (req.app.locals.io) {
      req.app.locals.io.to(`device:${deviceId}`).emit('location', {
        deviceId, lat, lon, accuracy, timestamp: loc.timestamp || loc.createdAt
      });
    }
    res.json({ ok: true, location: loc });
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal' }); }
});

// list locations (only for owner)
router.get('/location', auth, async (req, res) => {
  try {
    const q = { ownerId: req.userId };
    if (req.query.deviceId) q.deviceId = req.query.deviceId;
    const items = await Location.find(q).sort({ timestamp: -1 }).limit(1000);
    res.json(items);
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal' }); }
});

// POST sms
router.post('/sms', auth, async (req, res) => {
  try {
    const { deviceId, sender, message, timestamp } = req.body;
    const s = new Sms({ deviceId, ownerId:req.userId, sender, message, timestamp: timestamp ? new Date(timestamp) : new Date() });
    await s.save();
    res.json({ ok: true, sms: s });
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal' }); }
});

// list sms
router.get('/sms', auth, async (req, res) => {
  try {
    const q = { ownerId: req.userId };
    if (req.query.deviceId) q.deviceId = req.query.deviceId;
    const items = await Sms.find(q).sort({ createdAt: -1 }).limit(500);
    res.json(items);
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal' }); }
});

// calls similar
router.post('/call', auth, async (req, res) => {
  try {
    const { deviceId, number, type, state, timestamp, duration } = req.body;
    const c = new (require('../models/Call'))({ deviceId, ownerId: req.userId, number, type, state, timestamp: timestamp? new Date(timestamp): new Date(), duration });
    await c.save();
    res.json({ ok: true, call: c });
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal' }); }
});
router.get('/call', auth, async (req, res) => {
  try {
    const q = { ownerId: req.userId };
    if (req.query.deviceId) q.deviceId = req.query.deviceId;
    const items = await require('../models/Call').find(q).sort({ createdAt: -1 }).limit(500);
    res.json(items);
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal' }); }
});

module.exports = router;
