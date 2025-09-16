const express = require('express');
const router = express.Router();
const License = require('../models/License');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');
const crypto = require('crypto');

// Admin: Gerar uma chave de ativação
router.post('/generate', auth, async (req, res) => {
  try {
    // Verifica se o usuário é admin
    const u = await User.findById(req.userId);
    if (!u || u.role !== 'admin') return res.status(403).json({ error: 'admin only' });

    const { generatedForEmail, deviceId } = req.body;
    const key = crypto.randomBytes(12).toString('hex'); // Gera uma chave de 24 caracteres

    const license = new License({ key, generatedForEmail, deviceId, active: true });
    await license.save();

    res.json({ ok: true, key, license });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao gerar chave' });
  }
});

// Validar chave de ativação
router.post('/validate', auth, async (req, res) => {
  try {
    const { key, deviceId } = req.body;
    const license = await License.findOne({ key, active: true });
    if (!license) return res.status(400).json({ error: 'Chave inválida' });

    // Se a chave for válida, ativa o dispositivo
    license.usedByUserId = req.userId;
    license.activatedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    license.expiresAt = expiresAt;
    license.active = false; // Chave única, não pode ser usada novamente

    await license.save();

    // Se o deviceId for fornecido, ativa o dispositivo
    if (deviceId) {
      let device = await Device.findOne({ deviceId });
      if (!device) {
        device = new Device({ deviceId, ownerId: req.userId, activated: true, lastSeen: new Date() });
      } else {
        device.ownerId = req.userId;
        device.activated = true;
        device.lastSeen = new Date();
      }
      await device.save();
    }

    res.json({ ok: true, message: 'Licença ativada', expiresAt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao validar chave' });
  }
});

module.exports = router;
