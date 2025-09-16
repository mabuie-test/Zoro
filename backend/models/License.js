const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const LicenseSchema = new Schema({
  key: { type: String, required: true, unique: true, index: true },
  generatedForEmail: { type: String }, // optional to track who admin intended it for
  usedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  deviceId: { type: String }, // optional binding to a device
  activatedAt: Date,
  expiresAt: Date,
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('License', LicenseSchema);
