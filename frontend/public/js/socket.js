// ensure single socket instance and expose globally
if (!window.__monitor_socket) {
  window.__monitor_socket = io({
    path: '/socket.io'
  });

  window.__monitor_socket.on('connect', () => console.log('monitor socket connected', window.__monitor_socket.id));
  window.__monitor_socket.on('connect_error', (err) => console.error('socket connect_error', err && err.message ? err.message : err));
  window.__monitor_socket.on('disconnect', (reason) => console.warn('socket disconnected', reason));
}
