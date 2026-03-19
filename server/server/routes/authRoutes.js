const express = require('express');
const router = express.Router();
const passport = require('../auth');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const store = require('../store');
const { sendPasswordResetEmail } = require('../mailer');

router.post('/register', async (req, res) => {
  const { username, full_name, email, password } = req.body;
  if (!username || !full_name || !email || !password)
    return res.status(400).json({ error: 'All fields are required' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Invalid email address' });
  if (store.getUserByUsername(username))
    return res.status(409).json({ error: 'Username already taken' });
  if (store.getUserByEmail(email))
    return res.status(409).json({ error: 'Email already registered' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const user = store.createUser({ username, full_name, email, password_hash: hash, role: 'user' });
    res.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login/user', (req, res, next) => {
  passport.authenticate('local-user', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message || 'Invalid credentials' });
    if (user.totp_enabled) {
      req.session.pendingUserId = user.id;
      return res.json({ requiresTOTP: true });
    }
    req.logIn(user, (err) => {
      if (err) return next(err);
      res.json({ success: true, user: { id: user.id, username: user.username, role: user.role, totp_enabled: user.totp_enabled } });
    });
  })(req, res, next);
});

router.post('/login/admin', (req, res, next) => {
  passport.authenticate('local-admin', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message || 'Invalid credentials' });
    if (user.totp_enabled) {
      req.session.pendingUserId = user.id;
      return res.json({ requiresTOTP: true });
    }
    req.logIn(user, (err) => {
      if (err) return next(err);
      res.json({ success: true, user: { id: user.id, username: user.username, role: user.role, totp_enabled: user.totp_enabled } });
    });
  })(req, res, next);
});

router.post('/verify-totp', (req, res) => {
  const { token } = req.body;
  const userId = req.session.pendingUserId;
  if (!userId) return res.status(400).json({ error: 'No pending login' });
  const user = store.getUserById(userId);
  if (!user) return res.status(400).json({ error: 'User not found' });
  const verified = speakeasy.totp.verify({ secret: user.totp_secret, encoding: 'base32', token, window: 1 });
  if (!verified) return res.status(401).json({ error: 'Invalid authenticator code' });
  delete req.session.pendingUserId;
  req.logIn(user, (err) => {
    if (err) return res.status(500).json({ error: 'Login failed' });
    res.json({ success: true, user: { id: user.id, username: user.username, role: user.role, totp_enabled: user.totp_enabled } });
  });
});

router.post('/setup-totp', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  const secret = speakeasy.generateSecret({ name: `SSA (${req.user.username})`, length: 20 });
  store.updateUser(req.user.id, { totp_secret: secret.base32 });
  const qr = await QRCode.toDataURL(secret.otpauth_url);
  res.json({ qr, secret: secret.base32 });
});

router.post('/confirm-totp', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  const { token } = req.body;
  const user = store.getUserById(req.user.id);
  const verified = speakeasy.totp.verify({ secret: user.totp_secret, encoding: 'base32', token, window: 1 });
  if (!verified) return res.status(400).json({ error: 'Invalid code — try again' });
  store.updateUser(req.user.id, { totp_enabled: true });
  res.json({ success: true });
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const successMsg = { success: true, message: 'If that email is registered, a reset link has been sent.' };
  try {
    const user = store.getUserByEmail(email);
    if (!user || user.role !== 'user') return res.json(successMsg);
    const token = store.createResetToken(user.id);
    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    await sendPasswordResetEmail(user.email, resetLink, user.full_name);
    res.json(successMsg);
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const record = store.getResetToken(token);
  if (!record) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  try {
    const hash = await bcrypt.hash(password, 12);
    store.updateUser(record.userId, { password_hash: hash });
    store.markTokenUsed(token);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/reset-password/validate', (req, res) => {
  const { token } = req.query;
  if (!token) return res.json({ valid: false });
  const record = store.getResetToken(token);
  res.json({ valid: !!record });
});

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.CLIENT_URL}/login?error=google` }),
  (req, res) => {
    if (req.user.totp_enabled) {
      req.session.pendingUserId = req.user.id;
      req.logout(() => {});
      return res.redirect(`${process.env.CLIENT_URL}/login?requiresTOTP=1&role=admin`);
    }
    res.redirect(`${process.env.CLIENT_URL}/dashboard`);
  }
);

router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  const { id, username, full_name, email, role, totp_enabled } = req.user;
  res.json({ id, username, full_name, email, role, totp_enabled });
});

router.post('/logout', (req, res) => {
  req.logout(() => res.json({ success: true }));
});

module.exports = router;