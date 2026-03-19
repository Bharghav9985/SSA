import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import './UserDashboard.css';

export default function UserDashboard() {
  const { user, logout } = useAuth();
  const [sharing, setSharing] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const previewRef = useRef(null);
  const peersRef = useRef({});

  useEffect(() => {
    const socket = io({ withCredentials: true });
    socketRef.current = socket;

    socket.on('viewer-connected', async ({ viewerSocketId }) => {
      setViewerCount(c => c + 1);
      const pc = createPeerConnection(viewerSocketId);
      peersRef.current[viewerSocketId] = pc;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current));
      }
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('offer', { to: viewerSocketId, offer });
    });

    socket.on('viewer-disconnected', ({ viewerSocketId }) => {
      setViewerCount(c => Math.max(0, c - 1));
      if (peersRef.current[viewerSocketId]) {
        peersRef.current[viewerSocketId].close();
        delete peersRef.current[viewerSocketId];
      }
    });

    socket.on('answer', async ({ from, answer }) => {
      const pc = peersRef.current[from];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('ice-candidate', async ({ from, candidate }) => {
      const pc = peersRef.current[from];
      if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    return () => socket.disconnect();
  }, []);

  const createPeerConnection = (viewerSocketId) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pc.onicecandidate = (e) => {
      if (e.candidate) socketRef.current.emit('ice-candidate', { to: viewerSocketId, candidate: e.candidate });
    };
    return pc;
  };

  const startSharing = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: { echoCancellation: false, noiseSuppression: false, sampleRate: 44100 },
      });
      streamRef.current = stream;
      if (previewRef.current) previewRef.current.srcObject = stream;
      stream.getVideoTracks()[0].addEventListener('ended', () => stopSharing());
      setSharing(true);
      socketRef.current.emit('start-sharing');
    } catch (err) {
      if (err.name !== 'NotAllowedError') console.error('Screen capture error:', err);
    }
  };

  const stopSharing = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (previewRef.current) previewRef.current.srcObject = null;
    Object.values(peersRef.current).forEach(pc => pc.close());
    peersRef.current = {};
    setSharing(false);
    setViewerCount(0);
    socketRef.current.emit('stop-sharing');
  };

  return (
    <div className="dash-bg">
      <div className="dash-glow" />
      <nav className="dash-nav fade-up">
        <div className="nav-logo">
          <span className="logo-mark-sm">S</span><span className="logo-text-sm">SA</span>
        </div>
        <div className="nav-right">
          <span className="nav-user"><span className="user-dot" />{user?.username}</span>
          <span className="nav-badge user">User</span>
          <button className="nav-logout" onClick={logout}>Sign out</button>
        </div>
      </nav>

      <main className="dash-main">
        <div className="dash-hero fade-up-d1">
          <h1>Share Your Screen</h1>
          <p>When you click <em>Start Sharing</em>, choose which screen or window to share — along with system audio.</p>
        </div>

        <div className="share-card fade-up-d2">
          {!sharing ? (
            <div className="share-idle">
              <div className="share-icon-ring">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
              </div>
              <h2>Ready to share</h2>
              <p>Your screen is private until you start sharing</p>
              <button className="btn-share start" onClick={startSharing}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                </svg>
                Start Sharing
              </button>
            </div>
          ) : (
            <div className="share-active">
              <div className="share-preview-wrap">
                <video ref={previewRef} autoPlay muted playsInline className="share-preview" />
                <div className="live-badge"><span className="live-dot" />LIVE</div>
              </div>
              <div className="share-info">
                <div className="share-stats">
                  <div className="stat"><span className="stat-val">{viewerCount}</span><span className="stat-label">Viewers</span></div>
                  <div className="stat-divider" />
                  <div className="stat"><span className="stat-val green">●</span><span className="stat-label">Sharing</span></div>
                </div>
                <button className="btn-share stop" onClick={stopSharing}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
                  Stop Sharing
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="share-tips fade-up-d3">
          <div className="tip"><span>🖥</span><span>Choose a window, tab, or entire screen</span></div>
          <div className="tip"><span>🔊</span><span>System audio is captured automatically</span></div>
          <div className="tip"><span>👁</span><span>Only the admin can view your stream</span></div>
        </div>
      </main>
    </div>
  );
}