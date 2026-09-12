#!/usr/bin/env node
// Make a password hash for the ADMIN_USERS env var.
//
//   node api/_lib/hash-password.js 'the password'
//
// Paste the printed hash into the user's "hash" field. Never commit the result
// anywhere in this repo; it belongs in Vercel's environment variables.
const { hashPassword } = require('./auth');

const pw = process.argv[2];
if (!pw) {
  console.error("usage: node api/_lib/hash-password.js '<password>'");
  process.exit(1);
}
console.log(hashPassword(pw));
