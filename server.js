const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(bodyParser.json({limit: '2mb'}));
app.use(express.static('public'));

const users = {}; // username -> { password, avatar(dataURL) }
const sessions = {}; // token -> username
const socketsByUser = {}; // username -> socket.id
const messages = []; // last messages {user, avatar, text, ts}

// helpers
function makeToken(){ return crypto.randomBytes(16).toString('hex'); }
function now(){ return Date.now(); }

// api: register
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).json({ error: 'missing' });
  if(users[username]) return res.status(400).json({ error: 'exists' });
  users[username] = { password, avatar: null };
  return res.json({ ok: true });
});

// api: login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const u = users[username];
  if(!u || u.password !== password) return res.status(401).json({ error: 'invalid' });
  const token = makeToken();
  sessions[token] = username;
  return res.json({ ok: true, token, username, avatar: u.avatar || null });
});

// api: get me
app.get('/me', (req, res) => {
  const token = req.query.token;
  const username = sessions[token];
  if(!username) return res.status(401).json({ error: 'unauth' });
  const u = users[username];
  return res.json({ username, avatar: u.avatar || null });
});

// api: upload avatar (data url)
app.post('/avatar', (req, res) => {
  const { token, dataUrl } = req.body;
  const username = sessions[token];
  if(!username) return res.status(401).json({ error: 'unauth' });
  users[username].avatar = dataUrl;
  // notify others about avatar change
  io.emit('user-update', { username, avatar: dataUrl });
  return res.json({ ok: true });
});

// serve last messages and simple user list via socket on auth
io.on('connection', (socket) => {
  let authUser = null;

  socket.on('auth', (token) => {
    const username = sessions[token];
    if(!username) {
      socket.emit('auth-fail');
      return;
    }
    authUser = username;
    socketsByUser[username] = socket.id;
    // send initial state
    socket.emit('init', { username, avatar: users[username].avatar || null, messages, users: Object.keys(users).map(u => ({ username: u, avatar: users[u].avatar })) });
    io.emit('user-joined', { username, avatar: users[username].avatar || null });
  });

  socket.on('message', (txt) => {
    if(!authUser) return;
    const msg = { user: authUser, avatar: users[authUser].avatar || null, text: String(txt).slice(0,1000), ts: now() };
    messages.push(msg);
    if(messages.length > 200) messages.shift();
    io.emit('message', msg);
  });

  socket.on('disconnect', () => {
    if(authUser) {
      delete socketsByUser[authUser];
      io.emit('user-left', { username: authUser });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('server listening on', PORT);
});
