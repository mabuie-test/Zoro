const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DeviceSchema = new Schema({
  deviceId: { type: String, required: true, index: true, unique: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
  label: String,
  activated: { type: Boolean, default: false },
  lastSeen: Date,
  online: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Device', DeviceSchema);
