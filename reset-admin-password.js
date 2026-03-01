const argon2 = require('argon2');

async function hashPassword() {
  const password = 'Admin@123';
  const hash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
  console.log(hash);
}

hashPassword();
