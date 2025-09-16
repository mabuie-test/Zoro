const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const MediaMeta = require('../models/MediaMeta');
const auth = require('../middleware/authMiddleware');

const uploadDir = process.env.UPLOAD_DIR || 'uploads';
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadDir); },
  filename: function (req, file, cb) { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage });

// upload media (protected)
router.post('/upload', auth, upload.single('media'), async (req, res) => {
  try {
    const { deviceId, type } = req.body;
    if (!req.file) return res.status(400).json({ error: 'no file' });
    const meta = new MediaMeta({
      deviceId,
      ownerId: req.userId,
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      length: req.file.size,
      filepath: req.file.path,
      type: type || 'media'
    });
    await meta.save();
    res.json({ ok: true, meta });
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal' }); }
});

// list media
router.get('/', auth, async (req, res) => {
  try {
    const q = { ownerId: req.userId };
    if (req.query.deviceId) q.deviceId = req.query.deviceId;
    const items = await MediaMeta.find(q).sort({ createdAt: -1 }).limit(200);
    res.json(items);
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal' }); }
});

// serve file (protected)
router.get('/:id', auth, async (req, res) => {
  try {
    const meta = await MediaMeta.findById(req.params.id);
    if (!meta) return res.status(404).send('not found');
    if (meta.ownerId && meta.ownerId.toString() !== req.userId) return res.status(403).send('forbidden');
    res.sendFile(path.resolve(meta.filepath));
  } catch (e) { console.error(e); res.status(500).send('internal'); }
});

module.exports = router;
