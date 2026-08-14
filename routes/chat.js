const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin } = require('../middleware/auth');

// Start (or resume) a conversation about an item or listing
router.post('/start', requireLogin, (req, res) => {
  const { item_type, item_id } = req.body;
  const table = item_type === 'item' ? 'items' : 'listings';
  const target = db.prepare(`SELECT user_id FROM ${table} WHERE id = ?`).get(item_id);

  if (!target) return res.status(404).send('Not found');
  const ownerId = target.user_id;
  if (ownerId === req.session.user.id) return res.redirect('/' + (item_type === 'item' ? 'items' : 'marketplace') + '/' + item_id);

  let convo = db.prepare(
    `SELECT * FROM conversations WHERE item_type=? AND item_id=? AND initiator_id=? AND owner_id=?`
  ).get(item_type, item_id, req.session.user.id, ownerId);

  if (!convo) {
    const info = db.prepare(
      `INSERT INTO conversations (item_type, item_id, initiator_id, owner_id) VALUES (?,?,?,?)`
    ).run(item_type, item_id, req.session.user.id, ownerId);
    convo = { id: info.lastInsertRowid };
  }

  res.redirect('/chat/' + convo.id);
});

router.get('/', requireLogin, (req, res) => {
  const convos = db.prepare(`
    SELECT conversations.*,
      (SELECT content FROM messages WHERE conversation_id = conversations.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT name FROM users WHERE id = CASE WHEN conversations.initiator_id = ? THEN conversations.owner_id ELSE conversations.initiator_id END) as other_name
    FROM conversations
    WHERE initiator_id = ? OR owner_id = ?
    ORDER BY conversations.created_at DESC
  `).all(req.session.user.id, req.session.user.id, req.session.user.id);

  res.render('chat/inbox', { convos });
});

router.get('/:id', requireLogin, (req, res) => {
  const convo = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!convo || (convo.initiator_id !== req.session.user.id && convo.owner_id !== req.session.user.id)) {
    return res.status(403).send('Forbidden');
  }

  const messages = db.prepare(`
    SELECT messages.*, users.name as sender_name
    FROM messages JOIN users ON messages.sender_id = users.id
    WHERE conversation_id = ? ORDER BY created_at ASC`).all(req.params.id);

  res.render('chat/conversation', { convo, messages });
});

router.post('/:id/message', requireLogin, (req, res) => {
  const convo = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!convo || (convo.initiator_id !== req.session.user.id && convo.owner_id !== req.session.user.id)) {
    return res.status(403).send('Forbidden');
  }

  db.prepare(`INSERT INTO messages (conversation_id, sender_id, content) VALUES (?,?,?)`)
    .run(req.params.id, req.session.user.id, req.body.content);

  const io = req.app.get('io');
  io.to('conversation-' + req.params.id).emit('new-message', {
    sender_id: req.session.user.id,
    sender_name: req.session.user.name,
    content: req.body.content,
    created_at: new Date().toISOString()
  });

  res.redirect('/chat/' + req.params.id);
});

module.exports = router;
