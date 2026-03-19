const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const store = require('./store');

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser((id, done) => {
  const user = store.getUserById(id);
  done(null, user || false);
});

passport.use('local-user', new LocalStrategy(
  { usernameField: 'username', passwordField: 'password' },
  async (username, password, done) => {
    try {
      const user = store.getUserByUsername(username);
      if (!user || user.role !== 'user') return done(null, false, { message: 'Invalid credentials' });
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return done(null, false, { message: 'Invalid credentials' });
      return done(null, user);
    } catch (err) { return done(err); }
  }
));

passport.use('local-admin', new LocalStrategy(
  { usernameField: 'username', passwordField: 'password' },
  async (username, password, done) => {
    try {
      const user = store.getUserByUsername(username);
      if (!user || user.role !== 'admin') return done(null, false, { message: 'Invalid credentials' });
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return done(null, false, { message: 'Invalid credentials' });
      return done(null, user);
    } catch (err) { return done(err); }
  }
));

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;
    if (email !== process.env.ADMIN_GOOGLE_EMAIL) {
      return done(null, false, { message: 'Unauthorized Google account' });
    }
    let user = store.getUserByGoogleId(profile.id);
    if (!user) {
      user = store.createUser({
        username: email,
        full_name: profile.displayName,
        email,
        role: 'admin',
        google_id: profile.id,
        password_hash: null,
      });
    }
    return done(null, user);
  } catch (err) { return done(err); }
}));

module.exports = passport;