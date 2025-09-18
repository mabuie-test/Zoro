require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const { connect } = require('./config/db');
const mongoose = require('mongoose');

// suppress strictQuery noise (already set in config but safe)
mongoose.set('strictQuery', false);

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

connect(MONGO_URI).catch(err => { console.error(err); process.exit(1); });

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

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_BASE_URL || '*',
    methods: ['GET','POST'],
    credentials: true
  },
  path: '/socket.io'
});

// socket rooms: dashboards join `device:<deviceId>`
io.on('connection', socket => {
  console.log('socket connected', socket.id, 'from', socket.handshake.address);

  socket.on('joinDevice', deviceId => {
    if (!deviceId) return;
    const room = `device:${deviceId}`;
    socket.join(room);
    console.log('socket', socket.id, 'joined', room);
  });

  socket.on('leaveDevice', deviceId => {
    if (!deviceId) return;
    const room = `device:${deviceId}`;
    socket.leave(room);
    console.log('socket', socket.id, 'left', room);
  });

  socket.on('screenCapture', payload => {
    // expected payload: { deviceId, data } OR raw data with deviceId prop
    try {
      if (payload && payload.deviceId) {
        io.to(`device:${payload.deviceId}`).emit('screenCapture', payload.data || payload);
      } else {
        socket.broadcast.emit('screenCapture', payload);
      }
    } catch (e) { console.error('screenCapture emit err', e); }
  });

  socket.on('audioCapture', payload => {
    try {
      if (payload && payload.deviceId) {
        io.to(`device:${payload.deviceId}`).emit('audioCapture', payload.data || payload);
      } else {
        socket.broadcast.emit('audioCapture', payload);
      }
    } catch (e) { console.error('audioCapture emit err', e); }
  });

  socket.on('disconnect', reason => {
    console.log('socket disconnected', socket.id, 'reason', reason);
  });
});

app.locals.io = io;

server.listen(PORT, () => console.log('Server listening on', PORT));
