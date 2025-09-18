document.getElementById('btnLogin').addEventListener('click', async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const r = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password })});
  const j = await r.json();
  if (r.ok) {
    localStorage.setItem('token', j.token);
    window.location = '/dashboard.html';
  } else {
    document.getElementById('msg').innerText = j.error || 'Erro';
  }
});
