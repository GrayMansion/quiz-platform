'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

function LobbyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomCode = searchParams.get('code') || '';
  const displayName = searchParams.get('name') || 'Guest';
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<string>('');
  const [startCountdown, setStartCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!roomCode) return;
    let cancelled = false;

    fetch('/api/auth/socket-token')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const token = data.token || '';
        const s = io(WS_URL, {
          withCredentials: true,
          auth: token ? { token } : {},
        });
        socketRef.current = s;

        s.on('connect', () => {
          if (cancelled) { s.disconnect(); return; }
          setConnected(true);
          s.emit('session:join', { roomCode, displayName }, (res: any) => {
            if (res?.error) setError(res.error);
          });
        });

        s.on('session:state', (payload) => {
          if (cancelled) return;
          setState(payload);
          sessionIdRef.current = payload.sessionId;
          sessionStorage.setItem(`session_code_${payload.sessionId}`, roomCode);
          if (payload.participantId) {
            sessionStorage.setItem(`participant_${payload.sessionId}`, payload.participantId);
          }
          if (payload.status === 'QUESTION_OPEN') {
            router.push(`/session/${payload.sessionId}/play?code=${roomCode}&name=${encodeURIComponent(displayName)}`);
          } else if (payload.status === 'FINISHED') {
            router.push(`/session/${payload.sessionId}/results?code=${roomCode}`);
          }
        });

        s.on('question:open', () => {
          if (cancelled) return;
          const sid = sessionIdRef.current;
          if (sid) {
            router.push(`/session/${sid}/play?code=${roomCode}&name=${encodeURIComponent(displayName)}`);
          }
        });

        s.on('session:finished', (payload) => {
          if (cancelled) return;
          router.push(`/session/${payload.sessionId}/results?code=${roomCode}`);
        });

        s.on('session:error', (payload) => {
          if (cancelled) return;
          setError(payload.message);
        });

        s.on('countdown:start', (data) => {
          if (cancelled) return;
          setStartCountdown(data.count);
        });

        s.on('connect_error', () => {
          if (cancelled) return;
          setError('Cannot connect to quiz server. Please try again.');
        });

        s.on('disconnect', () => {
          if (cancelled) return;
          setConnected(false);
        });
      });

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
    };
  }, [roomCode, displayName]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Start countdown overlay */}
      {startCountdown !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-8xl font-bold text-white animate-pulse" key={startCountdown}>{startCountdown}</div>
            <p className="text-white/80 text-lg mt-4">Quiz starting...</p>
          </div>
        </div>
      )}

      <Navbar>
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-success-600' : 'bg-yellow-500'}`} />
        <span className="text-label text-text-secondary">
          {connected ? 'Connected' : error ? 'Error' : 'Connecting...'}
        </span>
      </Navbar>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="card w-full max-w-lg text-center">
          {error ? (
            <>
              <div className="text-5xl mb-4">😕</div>
              <h2 className="text-title font-bold mb-2">Cannot Join</h2>
              <div className="bg-danger-100 text-danger-600 p-3 rounded-8 mb-4">{error}</div>
              <Link href="/session/join" className="btn-primary">Try Again</Link>
            </>
          ) : !connected ? (
            <>
              <h2 className="text-title font-bold mb-4">Connecting to Quiz</h2>
              <div className="animate-pulse">
                <div className="w-10 h-10 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              </div>
              <p className="text-text-secondary">Establishing connection to the quiz server...</p>
            </>
          ) : (
            <>
              <h2 className="text-title font-bold mb-2">{state?.quizTitle || 'Quiz Lobby'}</h2>
              {roomCode && (
                <div className="inline-block bg-primary-100 text-primary-600 px-4 py-1 rounded-8 text-label font-medium mb-4">
                  Room: {roomCode}
                </div>
              )}
              <div className="text-label text-text-secondary mb-4">
                Playing as <span className="font-semibold text-text-primary">{displayName}</span>
              </div>
              <p className="text-4xl font-bold mb-1">{state?.participantCount ?? '...'}</p>
              <p className="text-text-secondary mb-8">participants joined</p>
              <div className="animate-pulse mb-6">
                <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-text-secondary">Waiting for organizer to start the quiz...</p>
              </div>
              <p className="text-xs text-text-secondary">
                The quiz begins when the organizer starts the session. Get ready!
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function LobbyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LobbyContent />
    </Suspense>
  );
}
