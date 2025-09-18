// scripts/create-admin.js
// Uso: node scripts/create-admin.js <email> <password>
// Alternativa: export ADMIN_EMAIL=... ADMIN_PASS=... && node scripts/create-admin.js

require('dotenv').config();
const bcrypt = require('bcrypt');
const { connect } = require('../config/db');
const User = require('../models/User');

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('ERRO: defina MONGO_URI no .env antes de executar.');
    process.exit(1);
  }

  const email = process.argv[2] || process.env.ADMIN_EMAIL;
  const password = process.argv[3] || process.env.ADMIN_PASS;

  if (!email || !password) {
    console.error('Uso: node scripts/create-admin.js <email> <password>');
    console.error('Ou export ADMIN_EMAIL e ADMIN_PASS e execute node scripts/create-admin.js');
    process.exit(1);
  }

  try {
    await connect(mongoUri);

    // Procura user existente
    let user = await User.findOne({ email: email.toLowerCase() });
    const hash = await bcrypt.hash(password, 10);

    if (user) {
      user.passwordHash = hash;
      user.role = 'admin';
      await user.save();
      console.log(`Usuário existente atualizado para admin: ${email}`);
    } else {
      user = new User({
        email: email.toLowerCase(),
        passwordHash: hash,
        name: 'Admin',
        role: 'admin'
      });
      await user.save();
      console.log(`Novo admin criado: ${email}`);
    }

    console.log('Feito. Agora pode iniciar sessão (login) com esse e-mail e password para obter o token JWT.');
    process.exit(0);
  } catch (err) {
    console.error('Erro ao criar admin:', err);
    process.exit(1);
  }
}

main();
