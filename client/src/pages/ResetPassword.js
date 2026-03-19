import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import './Login.css';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');

  const [valid, setValid] = useState(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) { setValid(false); return; }
    fetch(`/auth/reset-password/validate?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => setValid(d.valid))
      .catch(() => setValid(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('Passwords do not match');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    setLoading(true);
    try {
      const r = await fetch('/auth/reset-password', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error); setLoading(false); return; }
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch { setError('Network error'); }
    setLoading(false);
  };

  return (
    <div className="login-bg">
      <div className="login-glow" />
      <div className="login-card fade-up">
        <div className="login-logo">
          <span className="logo-mark">S</span><span className="logo-text">SA</span>
        </div>
        <p className="login-tagline">Screen Share Application</p>

        {valid === null && (
          <div className="login-form" style={{ alignItems: 'center', paddingTop: 24 }}>
            <span className="spinner" style={{ width: 28, height: 28 }} />
            <p style={{ color: 'var(--text3)', fontSize: 14, marginTop: 16 }}>Validating reset link…</p>
          </div>
        )}

        {valid === false && (
          <div className="login-form fade-up">
            <div className="totp-icon">⚠️</div>
            <h2 className="totp-title">Link expired</h2>
            <p className="totp-hint">This reset link is invalid or has already been used. Links expire after 1 hour.</p>
            <button className="btn-primary" onClick={() => navigate('/login')}>Back to Sign In</button>
          </div>
        )}

        {valid === true && !success && (
          <form onSubmit={handleSubmit} className="login-form fade-up">
            <div className="totp-icon">🔒</div>
            <h2 className="totp-title">Set New Password</h2>
            <p className="totp-hint">Choose a strong password — at least 8 characters.</p>
            <label>New Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoFocus />
            <label>Confirm Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required />
            {error && <p className="login-error">{error}</p>}
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Update Password'}
            </button>
          </form>
        )}

        {success && (
          <div className="login-form fade-up">
            <div className="totp-icon">✅</div>
            <h2 className="totp-title">Password updated!</h2>
            <p className="totp-hint">Your password has been changed. Redirecting to sign in…</p>
            <div className="login-success" style={{ textAlign: 'center' }}>Redirecting in 3 seconds…</div>
          </div>
        )}
      </div>
    </div>
  );
}
