// Usage: npm run make-admin -- user@college.edu
const db = require('../db');

const email = process.argv[2];
if (!email) {
  console.log('Usage: node scripts/make-admin.js user@college.edu');
  process.exit(1);
}

const info = db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(email.toLowerCase());
console.log(info.changes ? `${email} is now an admin.` : `No user found with email ${email}. Register that account first.`);
