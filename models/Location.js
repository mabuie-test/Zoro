const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const LocationSchema = new Schema({
  deviceId: { type: String, index: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  lat: Number,
  lon: Number,
  accuracy: Number,
  timestamp: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Location', LocationSchema);
