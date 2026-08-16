const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

router.get('/', (req, res) => {
  const flags = db.prepare(`SELECT flags.*, users.name as reporter_name
                             FROM flags JOIN users ON flags.reporter_id = users.id
                             WHERE flags.status = 'pending' ORDER BY flags.created_at DESC`).all();
  const users = db.prepare('SELECT id, name, email, role, status FROM users ORDER BY created_at DESC').all();
  res.render('admin/dashboard', { flags, users });
});

router.post('/flags/:id/resolve', (req, res) => {
  const flag = db.prepare('SELECT * FROM flags WHERE id = ?').get(req.params.id);
  if (flag && req.body.action === 'remove') {
    const table = flag.target_type === 'item' ? 'items' : 'listings';
    db.prepare(`UPDATE ${table} SET status = 'removed' WHERE id = ?`).run(flag.target_id);
  }
  db.prepare(`UPDATE flags SET status = 'reviewed' WHERE id = ?`).run(req.params.id);
  res.redirect('/admin');
});

router.post('/users/:id/suspend', (req, res) => {
  db.prepare(`UPDATE users SET status = 'suspended' WHERE id = ?`).run(req.params.id);
  res.redirect('/admin');
});

router.post('/users/:id/reinstate', (req, res) => {
  db.prepare(`UPDATE users SET status = 'active' WHERE id = ?`).run(req.params.id);
  res.redirect('/admin');
});

module.exports = router;
