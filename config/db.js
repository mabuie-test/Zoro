const mongoose = require('mongoose');

async function connect(uri) {
  // avoid strictQuery warning disruption
  mongoose.set('strictQuery', false);
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('MongoDB connected');
}

module.exports = { connect };
