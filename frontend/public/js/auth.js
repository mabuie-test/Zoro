// frontend/public/js/auth.js
document.getElementById('btnLogin').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!email || !password) return document.getElementById('msg').innerText = 'Email e senha são obrigatórios';

  try {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const j = await r.json();
    if (!r.ok) {
      document.getElementById('msg').innerText = j.error || 'Erro ao autenticar';
      return;
    }

    // guarda token
    localStorage.setItem('token', j.token);

    // usa a propriedade user retornada pelo backend para decidir redirect
    const role = j.user && j.user.role ? j.user.role : null;

    if (role === 'admin') {
      // redireciona para o painel admin
      window.location = '/admin.html';
    } else {
      // user normal
      window.location = '/dashboard.html';
    }
  } catch (err) {
    console.error('login error', err);
    document.getElementById('msg').innerText = 'Erro de comunicação';
  }
});
