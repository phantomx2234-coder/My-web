require('dotenv').config();
const express = require('express');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.set('io', io);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false
}));

// Make current user available in every view
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.get('/', (req, res) => res.render('index'));

app.use('/', require('./routes/auth'));
app.use('/items', require('./routes/items'));
app.use('/marketplace', require('./routes/marketplace'));
app.use('/chat', require('./routes/chat'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => res.status(404).send('Page not found'));

io.on('connection', (socket) => {
  socket.on('join', (conversationId) => {
    socket.join('conversation-' + conversationId);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
