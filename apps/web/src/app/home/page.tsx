'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function HomePage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [user, setUser] = useState<any>(null);
  const [recentQuizzes, setRecentQuizzes] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.data) {
          setUser(d.data);
          if (d.data.role === 'ORGANIZER') {
            fetch('/api/quizzes')
              .then((r) => r.json())
              .then((qd) => {
                const published = (qd.data || [])
                  .filter((q: any) => q.status === 'PUBLISHED')
                  .slice(0, 3);
                setRecentQuizzes(published);
              });
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleJoin = () => {
    if (roomCode.trim()) {
      router.push(`/session/join?code=${roomCode.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-5xl font-bold text-text-primary mb-4">
            Real-Time Quiz Platform
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Create engaging quizzes, host live sessions, and compete in real time.
            No account needed to play — just enter a room code and join!
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <div className="card">
            <h3 className="text-title font-semibold mb-6 text-center">Join a Quiz</h3>
            <p className="text-label text-text-secondary mb-4 text-center">
              Enter the room code to join an active quiz. Questions can be answered only while they are open.
            </p>
            <input
              type="text"
              maxLength={6}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="e.g. ABC123"
              className="input-field text-center text-2xl font-bold tracking-[0.3em] mb-4 uppercase"
              autoFocus
            />
            <button onClick={handleJoin} className="btn-primary w-full">
              Join lobby
            </button>
            <p className="text-xs text-text-secondary text-center mt-3">
              Enter the room code to join an active quiz.
            </p>
          </div>
        </div>

        {/* Quick-launch for organizers */}
        {recentQuizzes.length > 0 && (
          <div className="max-w-md mx-auto mt-8">
            <h3 className="text-lg font-semibold mb-3 text-center">Quick Launch</h3>
            <div className="space-y-3">
              {recentQuizzes.map((q: any) => (
                <Link
                  key={q.id}
                  href={`/quiz/${q.id}/launch`}
                  className="card flex items-center justify-between hover:border-primary-300 transition-colors cursor-pointer"
                >
                  <div>
                    <h4 className="font-semibold">{q.title}</h4>
                    <p className="text-label text-text-secondary">
                      {q.questionCount} questions · {q.category || 'General'}
                    </p>
                  </div>
                  <span className="btn-primary text-sm px-4 py-1.5">Launch</span>
                </Link>
              ))}
            </div>
            <div className="text-center mt-3">
              <Link href="/dashboard" className="text-label text-primary-600 hover:underline">
                View all quizzes →
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
