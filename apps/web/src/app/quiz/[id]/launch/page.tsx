'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function LaunchQuizPage() {
  const params = useParams();
  const router = useRouter();
  const quizId = params.id as string;

  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [sessionData, setSessionData] = useState<any>(null);

  // Session settings
  const [useDefaults, setUseDefaults] = useState(true);
  const [timeLimit, setTimeLimit] = useState(30);
  const [points, setPoints] = useState(100);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [autoAdvanceDelay, setAutoAdvanceDelay] = useState(5);

  useEffect(() => {
    fetch(`/api/quizzes/${quizId}`)
      .then((r) => r.json())
      .then((d) => { setQuiz(d.data); setLoading(false); })
      .catch(() => setError('Failed to load quiz'));
  }, [quizId]);

  const handleCreateSession = async () => {
    setCreating(true);
    setError('');
    try {
      const body = useDefaults ? { useDefaults: true } : { useDefaults: false, timeLimit, points, autoAdvance, autoAdvanceDelay };
      const res = await fetch(`/api/quizzes/${quizId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSessionData(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-2xl mx-auto px-6 py-8">
        <h2 className="text-title font-bold mb-6">Launch Quiz Session</h2>

        {error && <div className="bg-danger-100 text-danger-600 p-3 rounded-8 mb-4">{error}</div>}

        {!sessionData ? (
          <div className="card">
            <h3 className="text-lg font-semibold mb-1">{quiz?.title}</h3>
            <p className="text-text-secondary mb-4">{quiz?.description}</p>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-label">
                <span className="text-text-secondary">Category</span>
                <span>{quiz?.category || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-label">
                <span className="text-text-secondary">Questions</span>
                <span>{quiz?.questions?.length || 0}</span>
              </div>
              <div className="flex justify-between text-label">
                <span className="text-text-secondary">Default Time</span>
                <span>{quiz?.defaultTimeLimit}s</span>
              </div>
              <div className="flex justify-between text-label">
                <span className="text-text-secondary">Points per Question</span>
                <span>{quiz?.defaultPoints}</span>
              </div>
            </div>

            {/* Session Settings */}
            <div className="border border-border rounded-8 p-4 mb-6">
              <h4 className="font-semibold mb-3">Session Settings</h4>
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input type="checkbox" checked={useDefaults} onChange={(e) => setUseDefaults(e.target.checked)} className="accent-primary-600" />
                <span className="text-label">Use quiz defaults</span>
              </label>

              <div className={`space-y-3 ${useDefaults ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-text-secondary">Question time limit (sec)</label>
                    <input type="number" value={timeLimit || ''} onChange={(e) => setTimeLimit(e.target.value === '' ? 0 : parseInt(e.target.value))}
                      min={5} max={300} className="input-field" disabled={useDefaults} />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary">Points per question</label>
                    <input type="number" value={points || ''} onChange={(e) => setPoints(e.target.value === '' ? 0 : parseInt(e.target.value))}
                      min={1} max={10000} className="input-field" disabled={useDefaults} />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)}
                    className="accent-primary-600" disabled={useDefaults} />
                  <span className="text-label">Automatically advance to next question</span>
                </label>
                {autoAdvance && (
                  <div>
                    <label className="text-xs text-text-secondary">Auto-advance delay (sec)</label>
                    <input type="number" value={autoAdvanceDelay || ''} onChange={(e) => setAutoAdvanceDelay(e.target.value === '' ? 0 : parseInt(e.target.value))}
                      min={1} max={60} className="input-field" disabled={useDefaults} />
                  </div>
                )}
              </div>
              {useDefaults && <p className="text-xs text-text-secondary mt-3">Using the default settings from this quiz.</p>}
            </div>

            {quiz?.status !== 'PUBLISHED' ? (
              <div className="bg-danger-100 text-danger-600 p-3 rounded-8 text-label">
                This quiz must be published before launching a session.
                <Link href={`/quiz/${quizId}/edit`} className="underline ml-1 font-medium">Edit Quiz</Link>
              </div>
            ) : quiz?.questions?.length === 0 ? (
              <div className="bg-danger-100 text-danger-600 p-3 rounded-8 text-label">
                Add at least one question before launching.
                <Link href={`/quiz/${quizId}/edit`} className="underline ml-1 font-medium">Edit Quiz</Link>
              </div>
            ) : (
              <button onClick={handleCreateSession} disabled={creating} className="btn-primary w-full py-3">
                {creating ? 'Creating...' : '🚀 Start Live Session'}
              </button>
            )}
          </div>
        ) : (
          <div className="card text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-xl font-bold mb-2">Session Created!</h3>
            <p className="text-text-secondary mb-6">Share this room code with participants:</p>
            <div className="text-6xl font-bold tracking-[0.2em] text-primary-600 mb-6 bg-primary-100 py-4 rounded-12">
              {sessionData.roomCode}
            </div>
            <p className="text-text-secondary mb-6">Participants go to the homepage and enter this code to join.</p>
            <div className="flex gap-3">
              <Link href="/dashboard" className="btn-secondary flex-1">Dashboard</Link>
              <Link
                href={`/session/${sessionData.id}/control`}
                className="btn-primary flex-1"
              >
                Open Control Room
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
