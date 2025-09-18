const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SmsSchema = new Schema({
  deviceId: { type: String, index: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  sender: String,
  message: String,
  timestamp: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Sms', SmsSchema);
