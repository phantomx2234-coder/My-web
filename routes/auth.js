const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');

const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || 'college.edu';

router.get('/register', (req, res) => {
  res.render('register', { error: null, allowedDomain: ALLOWED_DOMAIN });
});

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!email || !email.toLowerCase().endsWith('@' + ALLOWED_DOMAIN)) {
    return res.render('register', {
      error: `Please use your @${ALLOWED_DOMAIN} campus email.`,
      allowedDomain: ALLOWED_DOMAIN
    });
  }
  if (!password || password.length < 6) {
    return res.render('register', {
      error: 'Password must be at least 6 characters.',
      allowedDomain: ALLOWED_DOMAIN
    });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.render('register', { error: 'Email already registered.', allowedDomain: ALLOWED_DOMAIN });
  }

  const hash = await bcrypt.hash(password, 10);
  const info = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(name, email.toLowerCase(), hash);

  req.session.user = { id: info.lastInsertRowid, name, email: email.toLowerCase(), role: 'student' };
  res.redirect('/');
});

router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').toLowerCase());

  if (!user) return res.render('login', { error: 'Invalid credentials.' });
  if (user.status === 'suspended') {
    return res.render('login', { error: 'This account has been suspended. Contact an admin.' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.render('login', { error: 'Invalid credentials.' });

  req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.redirect('/');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
