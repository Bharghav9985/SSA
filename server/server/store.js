const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const users = new Map();
const usersByUsername = new Map();
const usersByEmail = new Map();
const usersByGoogleId = new Map();
const resetTokens = new Map();

let nextId = 1;

function createUser({ username, full_name, email, password_hash, role = 'user', google_id = null }) {
  const id = nextId++;
  const user = { id, username, full_name, email: email?.toLowerCase(), password_hash, role, google_id, totp_secret: null, totp_enabled: false };
  users.set(id, user);
  if (username) usersByUsername.set(username, id);
  if (email) usersByEmail.set(email.toLowerCase(), id);
  if (google_id) usersByGoogleId.set(google_id, id);
  return user;
}

function getUserById(id) { return users.get(id) || null; }
function getUserByUsername(username) { const id = usersByUsername.get(username); return id ? users.get(id) : null; }
function getUserByEmail(email) { const id = usersByEmail.get(email?.toLowerCase()); return id ? users.get(id) : null; }
function getUserByGoogleId(googleId) { const id = usersByGoogleId.get(googleId); return id ? users.get(id) : null; }

function updateUser(id, fields) {
  const user = users.get(id);
  if (!user) return null;
  const updated = { ...user, ...fields };
  users.set(id, updated);
  return updated;
}

function createResetToken(userId) {
  for (const [token, data] of resetTokens.entries()) {
    if (data.userId === userId) resetTokens.delete(token);
  }
  const token = uuidv4() + '-' + uuidv4();
  resetTokens.set(token, {
    userId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    used: false,
  });
  return token;
}

function getResetToken(token) {
  const data = resetTokens.get(token);
  if (!data) return null;
  if (data.used) return null;
  if (new Date() > data.expiresAt) return null;
  return data;
}

function markTokenUsed(token) {
  const data = resetTokens.get(token);
  if (data) resetTokens.set(token, { ...data, used: true });
}

module.exports = {
  createUser, getUserById, getUserByUsername, getUserByEmail, getUserByGoogleId, updateUser,
  createResetToken, getResetToken, markTokenUsed,
};