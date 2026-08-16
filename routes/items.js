const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const { requireLogin } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const CATEGORIES = ['Electronics', 'IDs/Cards', 'Keys', 'Apparel', 'Books', 'Other'];

// List + search + filter
router.get('/', (req, res) => {
  const { q, category, type } = req.query;
  let sql = `SELECT items.*, users.name as owner_name FROM items
             JOIN users ON items.user_id = users.id
             WHERE items.status != 'removed'`;
  const params = [];

  if (q) {
    sql += ` AND (items.title LIKE ? OR items.description LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`);
  }
  if (category) {
    sql += ` AND items.category = ?`;
    params.push(category);
  }
  if (type) {
    sql += ` AND items.type = ?`;
    params.push(type);
  }
  sql += ` ORDER BY items.created_at DESC`;

  const items = db.prepare(sql).all(...params);
  res.render('items/list', {
    items, categories: CATEGORIES,
    q: q || '', category: category || '', type: type || ''
  });
});

router.get('/new', requireLogin, (req, res) => {
  res.render('items/new', { categories: CATEGORIES });
});

router.post('/new', requireLogin, upload.single('image'), (req, res) => {
  const { type, title, description, category, location, date_occurred, identifying_detail } = req.body;
  const image_path = req.file ? '/uploads/' + req.file.filename : null;

  db.prepare(`INSERT INTO items
    (user_id, type, title, description, category, location, date_occurred, image_path, identifying_detail)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(req.session.user.id, type, title, description, category, location, date_occurred, image_path, identifying_detail || null);

  res.redirect('/items');
});

router.get('/:id', (req, res) => {
  const item = db.prepare(`
    SELECT items.*, users.name as owner_name, users.id as owner_id
    FROM items JOIN users ON items.user_id = users.id
    WHERE items.id = ?`).get(req.params.id);

  if (!item) return res.status(404).send('Item not found');

  // Only the owner can see claims (and the private identifying_detail stays server-side only)
  const claims = (req.session.user && req.session.user.id === item.owner_id)
    ? db.prepare(`SELECT claims.*, users.name as claimant_name, users.email as claimant_email
                  FROM claims JOIN users ON claims.claimant_id = users.id
                  WHERE item_id = ? ORDER BY created_at DESC`).all(item.id)
    : [];

  res.render('items/detail', { item, claims, flagged: req.query.flagged, claimed: req.query.claimed });
});

// Claim verification flow: claimant describes a detail, owner approves before contact is shared
router.post('/:id/claim', requireLogin, (req, res) => {
  const { submitted_detail } = req.body;
  db.prepare(`INSERT INTO claims (item_id, claimant_id, submitted_detail) VALUES (?,?,?)`)
    .run(req.params.id, req.session.user.id, submitted_detail);
  res.redirect('/items/' + req.params.id + '?claimed=1');
});

router.post('/:id/claims/:claimId/approve', requireLogin, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item || item.user_id !== req.session.user.id) return res.status(403).send('Forbidden');

  db.prepare(`UPDATE claims SET status = 'approved' WHERE id = ?`).run(req.params.claimId);
  db.prepare(`UPDATE items SET status = 'claimed' WHERE id = ?`).run(req.params.id);
  res.redirect('/items/' + req.params.id);
});

router.post('/:id/flag', requireLogin, (req, res) => {
  db.prepare(`INSERT INTO flags (target_type, target_id, reporter_id, reason) VALUES ('item', ?, ?, ?)`)
    .run(req.params.id, req.session.user.id, req.body.reason || 'No reason given');
  res.redirect('/items/' + req.params.id + '?flagged=1');
});

module.exports = router;
