const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'campus.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',      -- 'student' | 'admin'
  status TEXT NOT NULL DEFAULT 'active',     -- 'active' | 'suspended'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('lost','found')),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  location TEXT,
  date_occurred TEXT,
  image_path TEXT,
  identifying_detail TEXT,                  -- private, used for claim verification
  status TEXT NOT NULL DEFAULT 'open',       -- 'open' | 'claimed' | 'removed'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  price REAL,
  condition TEXT,
  transaction_type TEXT CHECK(transaction_type IN ('sale','rent')),
  image_path TEXT,
  status TEXT NOT NULL DEFAULT 'available',  -- 'available' | 'pending' | 'sold' | 'removed'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  claimant_id INTEGER NOT NULL,
  submitted_detail TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',    -- 'pending' | 'approved' | 'rejected'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(item_id) REFERENCES items(id),
  FOREIGN KEY(claimant_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_type TEXT NOT NULL CHECK(item_type IN ('item','listing')),
  item_id INTEGER NOT NULL,
  initiator_id INTEGER NOT NULL,
  owner_id INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(conversation_id) REFERENCES conversations(id)
);

CREATE TABLE IF NOT EXISTS flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,                 -- 'item' | 'listing'
  target_id INTEGER NOT NULL,
  reporter_id INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',    -- 'pending' | 'reviewed'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

module.exports = db;
