'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

export default function ControlPage() {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<any>(null);
  const [question, setQuestion] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any>(null);
  const [error, setError] = useState('');
  const [sessionStatus, setSessionStatus] = useState<string>('LOBBY');
  const [sessionData, setSessionData] = useState<any>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [starting, setStarting] = useState(false);

  const sessionId = typeof window !== 'undefined'
    ? window.location.pathname.split('/').filter(Boolean)[1]
    : '';

  // Load session data via HTTP
  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((d) => { if (d.data) setSessionData(d.data); })
      .catch(() => setError('Failed to load session data'));
  }, [sessionId]);

  // Connect Socket.IO and join
  useEffect(() => {
    if (!sessionId) return;
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

        s.on('connect', () => setConnected(true));
        s.on('disconnect', () => setConnected(false));

        s.on('session:state', (payload) => {
          if (cancelled) return;
          setState(payload);
          setSessionStatus(payload.status);
          if (payload.currentQuestion) setQuestion(payload.currentQuestion);
        });

        s.on('question:open', (payload) => {
          if (cancelled) return;
          setStarting(false);
          setQuestion(payload);
          setFeedback(null);
          setSessionStatus('QUESTION_OPEN');
        });

        s.on('question:closed', (payload) => {
          if (cancelled) return;
          setFeedback(payload);
          setLeaderboard(payload.leaderboard || []);
          setQuestion(null);
          setSessionStatus('QUESTION_CLOSED');
        });

        s.on('leaderboard:update', (payload) => {
          if (cancelled) return;
          setLeaderboard(payload);
        });

        s.on('session:finished', () => {
          router.push(`/session/${sessionId}/results`);
        });

        s.on('session:error', (payload) => {
          if (cancelled) return;
          setError(payload.message);
        });

        s.on('countdown:start', () => {
          if (cancelled) return;
          setStarting(true);
        });

        s.on('participant:joined', (payload) => {
          if (cancelled) return;
          if (typeof payload.participantCount === 'string') {
            const match = (payload.participantCount as string).match(/(\d+) \/ (\d+)/);
            if (match) setAnsweredCount(parseInt(match[1]));
          }
        });
      });

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
    };
  }, [sessionId, router]);

  // Join the session once we have both socket and room code
  useEffect(() => {
    if (socketRef.current?.connected && sessionData?.roomCode) {
      socketRef.current.emit('session:join', { roomCode: sessionData.roomCode }, (res: any) => {
        if (res?.error) setError(res.error);
      });
    }
  }, [connected, sessionData]);

  const emit = (event: string, cb?: (res: any) => void) => {
    const s = socketRef.current;
    if (!s) { setError('Not connected'); return; }
    s.emit(event, (res: any) => { if (res?.error) setError(res.error); if (cb) cb(res); });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar>
        {sessionData && (
          <span className="bg-primary-100 text-primary-600 px-3 py-0.5 rounded-8 text-label font-mono font-bold">{sessionData.roomCode}</span>
        )}
        <span className="text-label text-text-secondary">
          <span className="font-medium">{sessionStatus.replace('_', ' ')}</span>
        </span>
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success-600' : 'bg-danger-600'}`} />
      </Navbar>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {error && <div className="bg-danger-100 text-danger-600 p-3 rounded-8 mb-4">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <h3 className="font-semibold text-lg mb-4">Session Controls</h3>
              <div className="flex flex-wrap gap-3">
                {sessionStatus === 'LOBBY' && (
                  <>
                    <button onClick={() => emit('session:start')}
                      disabled={(state?.participantCount || 0) === 0 || starting}
                      className="btn-primary">
                      {starting ? 'Starting...' : '▶ Start Quiz'}
                    </button>
                    {(state?.participantCount || 0) === 0 && (
                      <p className="text-xs text-text-secondary mt-2">At least one participant must join before the quiz can start.</p>
                    )}
                  </>
                )}
                {sessionStatus === 'QUESTION_CLOSED' && <button onClick={() => emit('session:next')} className="btn-primary">⏭ Next Question</button>}
                {(sessionStatus === 'QUESTION_OPEN' || sessionStatus === 'QUESTION_CLOSED') && (
                  <button onClick={() => { if (confirm('End the quiz?')) emit('session:end'); }} className="btn-danger">⏹ End Quiz</button>
                )}
              </div>
              {sessionStatus === 'LOBBY' && <p className="text-xs text-text-secondary mt-3">Share room code <strong>{sessionData?.roomCode}</strong> with participants.</p>}
            </div>

            {question && (
              <div className="card">
                <h3 className="font-semibold text-lg mb-2">Current Question ({question.questionNumber}/{question.totalQuestions})</h3>
                <p className="text-lg mb-3">{question.text}</p>
                <div className="space-y-2">{question.options?.map((opt: any) => <div key={opt.id} className="border border-border rounded-8 p-3">{opt.text}</div>)}</div>
                {sessionStatus === 'QUESTION_OPEN' && (
                  <div className="mt-4 bg-primary-100 text-primary-600 p-3 rounded-8 text-center font-medium">{answeredCount} / {state?.participantCount || 0} answered</div>
                )}
              </div>
            )}

            {!question && sessionStatus !== 'LOBBY' && feedback && (
              <div className="card"><h3 className="font-semibold text-lg mb-3">Question Closed</h3><p className="text-text-secondary">Waiting to advance.</p></div>
            )}

            {sessionStatus === 'LOBBY' && !question && (
              <div className="card text-center py-12">
                <div className="animate-pulse mb-4"><div className="w-10 h-10 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" /></div>
                <h3 className="font-semibold text-lg mb-2">Lobby Open</h3>
                <p className="text-4xl font-bold text-primary-600">{state?.participantCount ?? '...'}</p>
                <p className="text-label text-text-secondary">participants in lobby</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {sessionStatus === 'LOBBY' && state?.participants && (
              <div className="card"><h3 className="font-semibold mb-3">Participants</h3>
                <div className="space-y-1 max-h-[300px] overflow-y-auto">
                  {state.participants.map((p: any) => <div key={p.id} className="text-label py-1 border-b border-border last:border-0">{p.displayName}</div>)}
                </div>
              </div>
            )}
            {leaderboard.length > 0 && (
              <div className="card"><h3 className="font-semibold mb-3">Leaderboard</h3>
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  {leaderboard.map((entry: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${entry.rank===1?'bg-yellow-400 text-white':entry.rank===2?'bg-gray-300 text-gray-700':entry.rank===3?'bg-orange-300 text-white':'bg-gray-100 text-text-secondary'}`}>{entry.rank}</span>
                        <span className="text-label font-medium">{entry.displayName}</span>
                      </div>
                      <span className="text-label font-bold text-primary-600">{entry.totalScore}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
