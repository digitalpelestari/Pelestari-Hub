// hash.js
import bcrypt from 'bcryptjs';

// GANTI TEKS DI BAWAH INI DENGAN PASSWORD YANG INGIN KAMU HASH
const passwordTeksBiasa = "admin123"; 

// Membuat salt dengan 10 rounds
const salt = bcrypt.genSaltSync(10);

// Menghasilkan string hash murni dari bcryptjs
const hashHasil = bcrypt.hashSync(passwordTeksBiasa, salt);

console.log("====================================================");
console.log("PASSWORD ASLI :", passwordTeksBiasa);
console.log("HASH BCRYPTJS :", hashHasil);
console.log("====================================================");