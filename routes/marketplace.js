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

const CATEGORIES = ['Textbooks', 'Electronics', 'Furniture', 'Apparel', 'Sports', 'Other'];

router.get('/', (req, res) => {
  const { q, category, transaction_type } = req.query;
  let sql = `SELECT listings.*, users.name as owner_name FROM listings
             JOIN users ON listings.user_id = users.id
             WHERE listings.status != 'removed'`;
  const params = [];

  if (q) {
    sql += ` AND (listings.title LIKE ? OR listings.description LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`);
  }
  if (category) {
    sql += ` AND listings.category = ?`;
    params.push(category);
  }
  if (transaction_type) {
    sql += ` AND listings.transaction_type = ?`;
    params.push(transaction_type);
  }
  sql += ` ORDER BY listings.created_at DESC`;

  const listings = db.prepare(sql).all(...params);
  res.render('marketplace/list', {
    listings, categories: CATEGORIES,
    q: q || '', category: category || '', transaction_type: transaction_type || ''
  });
});

router.get('/new', requireLogin, (req, res) => {
  res.render('marketplace/new', { categories: CATEGORIES });
});

router.post('/new', requireLogin, upload.single('image'), (req, res) => {
  const { title, description, category, price, condition, transaction_type } = req.body;
  const image_path = req.file ? '/uploads/' + req.file.filename : null;

  db.prepare(`INSERT INTO listings
    (user_id, title, description, category, price, condition, transaction_type, image_path)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(req.session.user.id, title, description, category, price, condition, transaction_type, image_path);

  res.redirect('/marketplace');
});

router.get('/:id', (req, res) => {
  const listing = db.prepare(`
    SELECT listings.*, users.name as owner_name, users.id as owner_id
    FROM listings JOIN users ON listings.user_id = users.id
    WHERE listings.id = ?`).get(req.params.id);

  if (!listing) return res.status(404).send('Listing not found');
  res.render('marketplace/detail', { listing, flagged: req.query.flagged });
});

router.post('/:id/status', requireLogin, (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!listing || listing.user_id !== req.session.user.id) return res.status(403).send('Forbidden');

  db.prepare('UPDATE listings SET status = ? WHERE id = ?').run(req.body.status, req.params.id);
  res.redirect('/marketplace/' + req.params.id);
});

router.post('/:id/flag', requireLogin, (req, res) => {
  db.prepare(`INSERT INTO flags (target_type, target_id, reporter_id, reason) VALUES ('listing', ?, ?, ?)`)
    .run(req.params.id, req.session.user.id, req.body.reason || 'No reason given');
  res.redirect('/marketplace/' + req.params.id + '?flagged=1');
});

module.exports = router;
