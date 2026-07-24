'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

function ResultsContent() {
  const searchParams = useSearchParams();
  const roomCode = searchParams.get('code') || '';
  const [sessionData, setSessionData] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState(0);

  const sessionId = typeof window !== 'undefined'
    ? window.location.pathname.split('/').filter(Boolean)[1]
    : '';

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    let cancelled = false;

    async function load() {
      try {
        // Use socket-token endpoint (can read HttpOnly cookies)
        const tokenRes = await fetch('/api/auth/socket-token');
        const tokenData = await tokenRes.json();
        const token = tokenData.token || '';

        const sessionRes = await fetch(`/api/sessions/${sessionId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setErrorCode(sessionRes.status);

        const session = await sessionRes.json();
        if (cancelled) return;

        if (!sessionRes.ok || !session.data) {
          setError(session.error || 'Failed to load session');
          return;
        }

        setSessionData(session.data);
        const sorted = [...(session.data.participants || [])].sort((a: any, b: any) => b.totalScore - a.totalScore);
        let rank = 0, prevScore = -1;
        const lb = sorted.map((p: any) => {
          if (p.totalScore !== prevScore) { rank = rank + 1; prevScore = p.totalScore; }
          return { rank, displayName: p.displayName, totalScore: p.totalScore, userId: p.userId || '' };
        });
        if (!cancelled) setLeaderboard(lb);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Network error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    const messages: Record<number, string> = { 401: 'Please log in to view this session.', 403: 'You don\'t have access to this session.', 404: 'Session not found.' };
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="card text-center max-w-md">
          <div className="text-4xl mb-3">😕</div>
          <h2 className="text-xl font-bold mb-2">{messages[errorCode] || 'Error'}</h2>
          <p className="text-text-secondary mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <Link href="/dashboard" className="btn-secondary">Back to Dashboard</Link>
            <button onClick={() => window.location.reload()} className="btn-primary">Try Again</button>
          </div>
        </div>
      </div>
    );
  }

  const winner = leaderboard[0];
  const totalParticipants = leaderboard.length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-title font-bold mb-2">Quiz Complete!</h2>
          <p className="text-lg text-text-secondary">{sessionData?.quizTitle}</p>
          {sessionData?.roomCode && <span className="inline-block mt-2 bg-primary-100 text-primary-600 px-3 py-0.5 rounded-8 text-label font-mono">{sessionData.roomCode}</span>}
        </div>

        {winner && (
          <div className="card text-center mb-8 border-2 border-yellow-400 bg-yellow-50/50">
            <div className="text-3xl mb-1">👑</div>
            <h3 className="text-2xl font-bold mb-1">{winner.displayName}</h3>
            <p className="text-lg font-bold text-primary-600">{winner.totalScore} pts</p>
            <p className="text-label text-text-secondary">1st Place · {totalParticipants} participants</p>
          </div>
        )}

        <div className="card">
          <h3 className="font-semibold mb-4">Final Leaderboard</h3>
          <div className="space-y-2">
            {leaderboard.map((entry, i) => (
              <div key={i} className={`flex items-center justify-between p-3 rounded-8 ${i < 3 ? 'bg-gray-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${entry.rank===1?'bg-yellow-400 text-white text-lg':entry.rank===2?'bg-gray-300 text-gray-700':entry.rank===3?'bg-orange-300 text-white':'bg-gray-100 text-text-secondary'}`}>{entry.rank}</span>
                  <span className="font-medium">{entry.displayName}</span>
                </div>
                <span className="font-bold text-primary-600 w-16 text-right">{entry.totalScore} pts</span>
              </div>
            ))}
          </div>
        </div>
        <div className="text-center mt-8"><Link href="/home" className="btn-primary">Back to Home</Link></div>
      </main>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <ResultsContent />
    </Suspense>
  );
}
