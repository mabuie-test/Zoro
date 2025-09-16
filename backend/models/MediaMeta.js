const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MediaMetaSchema = new Schema({
  deviceId: { type: String, index: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  filename: String,
  contentType: String,
  length: Number,
  filepath: String,
  type: String, // photo, audio, video, screen
  metadata: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MediaMeta', MediaMetaSchema);
