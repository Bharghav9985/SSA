require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const passport = require('./auth');
const authRoutes = require('./routes/authRoutes');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  },
});

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'ssa-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  },
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRoutes);
app.get('/health', (req, res) => res.json({ status: 'ok', app: 'SSA' }));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/build/index.html')));
}

const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));
io.use(wrap(passport.initialize()));
io.use(wrap(passport.session()));

io.use((socket, next) => {
  if (socket.request.user) return next();
  next(new Error('Unauthorized'));
});

const activeSharers = new Map();
const adminWatching = new Map();

io.on('connection', (socket) => {
  const user = socket.request.user;
  console.log(`Connected: ${user.username} (${user.role})`);

  if (user.role === 'admin') {
    socket.emit('sharers-list', Array.from(activeSharers.values()));
  }

  socket.on('start-sharing', () => {
    activeSharers.set(socket.id, { socketId: socket.id, username: user.username, userId: user.id });
    io.emit('sharers-update', Array.from(activeSharers.values()));
  });

  socket.on('stop-sharing', () => {
    activeSharers.delete(socket.id);
    io.emit('sharers-update', Array.from(activeSharers.values()));
    for (const [adminId, sharerId] of adminWatching.entries()) {
      if (sharerId === socket.id) {
        io.to(adminId).emit('sharer-disconnected');
        adminWatching.delete(adminId);
      }
    }
  });

  socket.on('admin-watch', ({ sharerSocketId }) => {
    if (user.role !== 'admin') return;
    adminWatching.set(socket.id, sharerSocketId);
    io.to(sharerSocketId).emit('viewer-connected', { viewerSocketId: socket.id });
  });

  socket.on('admin-stop-watch', ({ sharerSocketId }) => {
    adminWatching.delete(socket.id);
    io.to(sharerSocketId).emit('viewer-disconnected', { viewerSocketId: socket.id });
  });

  socket.on('offer', ({ to, offer }) => io.to(to).emit('offer', { from: socket.id, offer }));
  socket.on('answer', ({ to, answer }) => io.to(to).emit('answer', { from: socket.id, answer }));
  socket.on('ice-candidate', ({ to, candidate }) => io.to(to).emit('ice-candidate', { from: socket.id, candidate }));

  socket.on('disconnect', () => {
    if (activeSharers.has(socket.id)) {
      activeSharers.delete(socket.id);
      io.emit('sharers-update', Array.from(activeSharers.values()));
      for (const [adminId, sharerId] of adminWatching.entries()) {
        if (sharerId === socket.id) {
          io.to(adminId).emit('sharer-disconnected');
          adminWatching.delete(adminId);
        }
      }
    }
    adminWatching.delete(socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`SSA running on port ${PORT}`));