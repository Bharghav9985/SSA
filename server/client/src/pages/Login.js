import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

function RegisterForm({ onBack }) {
  const [form, setForm] = useState({ username: '', full_name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    if (form.password.length < 8) return setError('Password must be at least 8 characters');
    setLoading(true);
    try {
      const r = await fetch('/auth/register', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username, full_name: form.full_name, email: form.email, password: form.password }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error); setLoading(false); return; }
      setSuccess('Account created! You can now sign in.');
      setTimeout(() => onBack(), 2000);
    } catch { setError('Network error'); }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="login-form fade-up">
      <h2 className="form-title">Create Account</h2>
      <label>Full Name</label>
      <input value={form.full_name} onChange={set('full_name')} placeholder="Jane Smith" required />
      <label>Email</label>
      <input type="email" value={form.email} onChange={set('email')} placeholder="jane@example.com" required />
      <label>Username</label>
      <input value={form.username} onChange={set('username')} placeholder="janedoe" required autoComplete="username" />
      <label>Password <span className="label-hint">min. 8 characters</span></label>
      <input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required />
      <label>Confirm Password</label>
      <input type="password" value={form.confirm} onChange={set('confirm')} placeholder="••••••••" required />
      {error && <p className="login-error">{error}</p>}
      {success && <p className="login-success">{success}</p>}
      <button className="btn-primary" type="submit" disabled={loading}>
        {loading ? <span className="spinner" /> : 'Create Account'}
      </button>
      <button type="button" className="btn-ghost" onClick={onBack}>Back to Sign In</button>
    </form>
  );
}

function ForgotPasswordForm({ onBack }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await fetch('/auth/forgot-password', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error); setLoading(false); return; }
      setSent(true);
    } catch { setError('Network error'); }
    setLoading(false);
  };

  if (sent) return (
    <div className="login-form fade-up">
      <div className="totp-icon">📬</div>
      <h2 className="totp-title">Check your inbox</h2>
      <p className="totp-hint">
        If <strong>{email}</strong> is registered, we've sent a reset link. Check spam too — expires in <strong>1 hour</strong>.
      </p>
      <button type="button" className="btn-ghost" style={{ marginTop: 8 }} onClick={onBack}>Back to Sign In</button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="login-form fade-up">
      <div className="totp-icon">🔑</div>
      <h2 className="totp-title">Forgot Password?</h2>
      <p className="totp-hint">Enter your registered email and we'll send you a reset link.</p>
      <label>Email address</label>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" required />
      {error && <p className="login-error">{error}</p>}
      <button className="btn-primary" type="submit" disabled={loading}>
        {loading ? <span className="spinner" /> : 'Send Reset Link'}
      </button>
      <button type="button" className="btn-ghost" onClick={onBack}>Back to Sign In</button>
    </form>
  );
}

export default function Login() {
  const [role, setRole] = useState('user');
  const [view, setView] = useState('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [qrData, setQrData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    if (params.get('requiresTOTP')) setView('totp');
    if (params.get('role') === 'admin') setRole('admin');
    if (params.get('error') === 'google') setError('Google sign-in failed or unauthorized account.');
  }, [params]);

  const handleCredentials = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const endpoint = role === 'admin' ? '/auth/login/admin' : '/auth/login/user';
      const r = await fetch(endpoint, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error); setLoading(false); return; }
      if (d.requiresTOTP) { setView('totp'); setLoading(false); return; }
      setUser(d.user);
      if (!d.user.totp_enabled) {
        const setupR = await fetch('/auth/setup-totp', { method: 'POST', credentials: 'include' });
        const setupD = await setupR.json();
        setQrData(setupD);
        setView('setup-totp');
      } else {
        navigate('/dashboard');
      }
    } catch { setError('Network error'); }
    setLoading(false);
  };

  const handleTOTP = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await fetch('/auth/verify-totp', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: totpCode }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error); setLoading(false); return; }
      setUser(d.user);
      navigate('/dashboard');
    } catch { setError('Network error'); }
    setLoading(false);
  };

  const handleConfirmTOTP = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await fetch('/auth/confirm-totp', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: confirmCode }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error); setLoading(false); return; }
      navigate('/dashboard');
    } catch { setError('Network error'); }
    setLoading(false);
  };

  if (view === 'register') return (
    <div className="login-bg">
      <div className="login-glow" />
      <div className="login-card fade-up">
        <div className="login-logo"><span className="logo-mark">S</span><span className="logo-text">SA</span></div>
        <p className="login-tagline">Screen Share Application</p>
        <RegisterForm onBack={() => setView('credentials')} />
      </div>
    </div>
  );

  if (view === 'forgot') return (
    <div className="login-bg">
      <div className="login-glow" />
      <div className="login-card fade-up">
        <div className="login-logo"><span className="logo-mark">S</span><span className="logo-text">SA</span></div>
        <p className="login-tagline">Screen Share Application</p>
        <ForgotPasswordForm onBack={() => setView('credentials')} />
      </div>
    </div>
  );

  return (
    <div className="login-bg">
      <div className="login-glow" />
      <div className="login-card fade-up">
        <div className="login-logo">
          <span className="logo-mark">S</span><span className="logo-text">SA</span>
        </div>
        <p className="login-tagline">Screen Share Application</p>

        {view === 'credentials' && (
          <>
            <div className="role-toggle">
              <button className={role === 'user' ? 'active' : ''} onClick={() => { setRole('user'); setError(''); }}>User</button>
              <button className={role === 'admin' ? 'active' : ''} onClick={() => { setRole('admin'); setError(''); }}>Admin</button>
            </div>
            <form onSubmit={handleCredentials} className="login-form">
              <label>Username</label>
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder="your_username" required autoComplete="username" />
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
              {error && <p className="login-error">{error}</p>}
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Sign In'}
              </button>
              {role === 'user' && (
                <div className="login-links">
                  <button type="button" className="link-btn" onClick={() => { setView('forgot'); setError(''); }}>Forgot password?</button>
                  <button type="button" className="link-btn accent" onClick={() => { setView('register'); setError(''); }}>Create an account →</button>
                </div>
              )}
              {role === 'admin' && (
                <>
                  <button type="button" className="link-btn" style={{ textAlign: 'center', marginTop: 4 }} onClick={() => { setView('forgot'); setError(''); }}>Forgot password?</button>
                  <div className="divider"><span>or</span></div>
                  <a href="/auth/google" className="btn-google">
                    <svg viewBox="0 0 24 24" width="18" height="18">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </a>
                </>
              )}
            </form>
          </>
        )}

        {view === 'totp' && (
          <form onSubmit={handleTOTP} className="login-form fade-up">
            <div className="totp-icon">🔐</div>
            <h2 className="totp-title">Two-Factor Auth</h2>
            <p className="totp-hint">Enter the 6-digit code from your Google Authenticator app</p>
            <input className="totp-input" value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} autoFocus />
            {error && <p className="login-error">{error}</p>}
            <button className="btn-primary" type="submit" disabled={loading || totpCode.length !== 6}>
              {loading ? <span className="spinner" /> : 'Verify'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setView('credentials')}>Back</button>
          </form>
        )}

        {view === 'setup-totp' && qrData && (
          <div className="login-form fade-up">
            <div className="totp-icon">📱</div>
            <h2 className="totp-title">Set Up 2FA</h2>
            <p className="totp-hint">Scan this QR code with <strong>Google Authenticator</strong>, then enter the 6-digit code</p>
            <img src={qrData.qr} alt="QR Code" className="qr-code" />
            <form onSubmit={handleConfirmTOTP}>
              <input className="totp-input" value={confirmCode} onChange={e => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} />
              {error && <p className="login-error">{error}</p>}
              <button className="btn-primary" type="submit" disabled={loading || confirmCode.length !== 6} style={{ marginTop: 12 }}>
                {loading ? <span className="spinner" /> : 'Activate 2FA'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}