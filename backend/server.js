require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const { connect } = require('./config/db');

const authRouter = require('./routes/auth');
const devicesRouter = require('./routes/devices');
const dataRouter = require('./routes/data');
const mediaRouter = require('./routes/media');
const licensesRouter = require('./routes/licenses');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('Please set MONGO_URI in .env'); process.exit(1);
}
connect(MONGO_URI).catch(err=>{ console.error(err); process.exit(1); });

// static frontend
app.use(express.static(path.join(__dirname, 'frontend', 'public')));

// api routes
app.use('/api/auth', authRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/data', dataRouter);
app.use('/api/media', mediaRouter);
app.use('/api/licenses', licensesRouter);

// health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'public', 'index.html'));
});

// start server + socket.io
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: "*" } });

// socket rooms: dashboards join `device:<deviceId>`
io.on('connection', socket => {
  console.log('socket connected', socket.id);
  socket.on('joinDevice', deviceId => {
    if (!deviceId) return;
    socket.join(`device:${deviceId}`);
  });
  socket.on('leaveDevice', deviceId => { if (deviceId) socket.leave(`device:${deviceId}`); });
  socket.on('disconnect', () => {});
});

// make io available to routes (for emitting)
app.locals.io = io;

server.listen(PORT, () => console.log('Server listening on', PORT));
