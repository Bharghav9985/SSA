import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [sharers, setSharers] = useState([]);
  const [watching, setWatching] = useState(null);
  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const pcRef = useRef(null);

  useEffect(() => {
    const socket = io({ withCredentials: true });
    socketRef.current = socket;

    socket.on('sharers-list', setSharers);
    socket.on('sharers-update', setSharers);

    socket.on('sharer-disconnected', () => stopWatching(false));

    socket.on('offer', async ({ from, offer }) => {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      socket.emit('answer', { to: from, answer });
    });

    socket.on('ice-candidate', async ({ from, candidate }) => {
      if (pcRef.current && candidate) await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    });

    return () => socket.disconnect();
  }, []);

  const watchSharer = (sharer) => {
    if (watching) stopWatching(true);
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;
    pc.ontrack = (e) => {
      if (videoRef.current && e.streams[0]) videoRef.current.srcObject = e.streams[0];
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) socketRef.current.emit('ice-candidate', { to: sharer.socketId, candidate: e.candidate });
    };
    socketRef.current.emit('admin-watch', { sharerSocketId: sharer.socketId });
    setWatching(sharer);
  };

  const stopWatching = (emit = true) => {
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (emit && watching) socketRef.current.emit('admin-stop-watch', { sharerSocketId: watching.socketId });
    setWatching(null);
  };

  return (
    <div className="admin-bg">
      <div className="admin-glow-tl" />
      <div className="admin-glow-br" />

      <nav className="dash-nav fade-up">
        <div className="nav-logo">
          <span className="logo-mark-sm">S</span><span className="logo-text-sm">SA</span>
          <span className="nav-admin-tag">Admin</span>
        </div>
        <div className="nav-right">
          <span className="nav-user"><span className="user-dot green" />{user?.username}</span>
          <span className="nav-badge admin">Admin</span>
          <button className="nav-logout" onClick={logout}>Sign out</button>
        </div>
      </nav>

      <main className="admin-main">
        <div className="admin-layout">
          <aside className="sharers-panel fade-up-d1">
            <div className="panel-header">
              <h2>Active Sharers</h2>
              <span className="sharer-count">{sharers.length}</span>
            </div>
            {sharers.length === 0 ? (
              <div className="no-sharers">
                <div className="no-sharers-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                </div>
                <p>No one is sharing yet</p>
                <span>Waiting for users to start a session</span>
              </div>
            ) : (
              <div className="sharers-list">
                {sharers.map((s) => (
                  <div
                    key={s.socketId}
                    className={`sharer-item ${watching?.socketId === s.socketId ? 'active' : ''}`}
                    onClick={() => watching?.socketId === s.socketId ? stopWatching() : watchSharer(s)}
                  >
                    <div className="sharer-avatar">{s.username?.[0]?.toUpperCase() || '?'}</div>
                    <div className="sharer-info">
                      <span className="sharer-name">{s.username}</span>
                      <span className="sharer-status"><span className="live-dot-sm" />Live</span>
                    </div>
                    <div className="sharer-action">
                      {watching?.socketId === s.socketId ? (
                        <span className="watching-badge">Watching</span>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>

          <section className="viewer-panel fade-up-d2">
            {!watching ? (
              <div className="viewer-empty">
                <div className="viewer-empty-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <h3>Select a sharer to watch</h3>
                <p>Click any user from the list to view their screen and hear their system audio in real time.</p>
              </div>
            ) : (
              <div className="viewer-active">
                <div className="viewer-topbar">
                  <div className="viewer-info">
                    <span className="viewer-live-dot" />
                    <span className="viewer-username">{watching.username}</span>
                    <span className="viewer-label">Live stream</span>
                  </div>
                  <button className="btn-stop-watch" onClick={() => stopWatching()}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
                    Stop Watching
                  </button>
                </div>
                <div className="viewer-screen">
                  <video ref={videoRef} autoPlay playsInline className="viewer-video" />
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
