// simple wrapper for client dashboards
const socket = io();
function joinDeviceRoom(deviceId) {
  if (!socket) return;
  socket.emit('joinDevice', deviceId);
}
function leaveDeviceRoom(deviceId) {
  if (!socket) return;
  socket.emit('leaveDevice', deviceId);
}
window.__monitor_socket = socket;
