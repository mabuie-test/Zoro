const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const LicenseSchema = new Schema({
  key: { type: String, required: true, unique: true, index: true },
  generatedForEmail: { type: String }, // opcional, para rastrear para quem a chave foi gerada
  usedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  deviceId: { type: String }, // opcional, associar a um dispositivo específico
  activatedAt: Date,
  expiresAt: Date,
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('License', LicenseSchema);
