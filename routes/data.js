const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Location = require('../models/Location');
const Sms = require('../models/Sms');
const Call = require('../models/Call');
const Device = require('../models/Device');

// POST location (device uses Authorization header with user token)
router.post('/location', auth, async (req, res) => {
  try {
    const { deviceId, lat, lon, accuracy, timestamp } = req.body;
    if (!deviceId || lat === undefined || lon === undefined) return res.status(400).json({ error: 'invalid' });
    const loc = new Location({
      deviceId, ownerId: req.userId, lat, lon, accuracy,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });
    await loc.save();
    // emit via socket.io
    if (req.app.locals.io) {
      req.app.locals.io.to(`device:${deviceId}`).emit('location', {
        deviceId, lat, lon, accuracy, timestamp: loc.timestamp || loc.createdAt
      });
    }
    // update device lastSeen
    await Device.findOneAndUpdate({ deviceId }, { $set: { lastSeen: new Date(), online: true } }, { upsert: true });
    res.json({ ok: true, location: loc });
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal' }); }
});

// list locations for owner
router.get('/location', auth, async (req, res) => {
  try {
    const q = { ownerId: req.userId };
    if (req.query.deviceId) q.deviceId = req.query.deviceId;
    const items = await Location.find(q).sort({ timestamp: -1 }).limit(1000);
    res.json(items);
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal' }); }
});

// sms endpoints
router.post('/sms', auth, async (req, res) => {
  try {
    const { deviceId, sender, message, timestamp } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
    const s = new Sms({ deviceId, ownerId: req.userId, sender, message, timestamp: timestamp ? new Date(timestamp) : new Date() });
    await s.save();
    res.json({ ok: true, sms: s });
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal' }); }
});

router.get('/sms', auth, async (req, res) => {
  try {
    const q = { ownerId: req.userId };
    if (req.query.deviceId) q.deviceId = req.query.deviceId;
    const items = await Sms.find(q).sort({ createdAt: -1 }).limit(500);
    res.json(items);
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal' }); }
});

// call endpoints
router.post('/call', auth, async (req, res) => {
  try {
    const { deviceId, number, type, state, timestamp, duration } = req.body;
    const c = new Call({ deviceId, ownerId: req.userId, number, type, state, timestamp: timestamp? new Date(timestamp) : new Date(), duration });
    await c.save();
    res.json({ ok: true, call: c });
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal' }); }
});

router.get('/call', auth, async (req, res) => {
  try {
    const q = { ownerId: req.userId };
    if (req.query.deviceId) q.deviceId = req.query.deviceId;
    const items = await Call.find(q).sort({ createdAt: -1 }).limit(500);
    res.json(items);
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal' }); }
});

module.exports = router;
