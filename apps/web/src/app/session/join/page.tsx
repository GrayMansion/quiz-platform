'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function JoinContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const codeFromUrl = searchParams.get('code') || '';
  const [roomCode, setRoomCode] = useState(codeFromUrl);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Check if user is logged in
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.data) {
          setUser(d.data);
          setDisplayName(d.data.displayName);
        }
      })
      .catch(() => {});
  }, []);

  const handleJoin = () => {
    if (!roomCode.trim() || roomCode.trim().length < 4) {
      setError('Enter a valid room code (4-6 characters)');
      return;
    }
    if (!displayName.trim()) {
      setError('Please enter your display name');
      return;
    }
    setJoining(true);
    setError('');
    const code = roomCode.trim().toUpperCase();
    router.push(`/session/${code}/lobby?code=${code}&name=${encodeURIComponent(displayName.trim())}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="card w-full max-w-md">
        <Link href="/" className="text-sm text-text-secondary hover:underline mb-4 block">
          &larr; Back to Home
        </Link>
        <h2 className="text-title font-bold mb-2">Join a Quiz</h2>
        <p className="text-label text-text-secondary mb-6">
          Enter the room code to join — no account needed!
        </p>

        {error && (
          <div className="bg-danger-100 text-danger-600 p-3 rounded-8 text-label mb-4">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="label-text">Room Code</label>
            <input
              type="text"
              maxLength={6}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="e.g. ABC123"
              className="input-field text-center text-2xl font-bold tracking-[0.3em] uppercase"
              autoFocus
            />
          </div>

          {!user && (
            <div>
              <label className="label-text">Your Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input-field"
                placeholder="Enter your name"
                maxLength={50}
              />
            </div>
          )}

          {user && (
            <div className="bg-primary-100 text-primary-600 p-3 rounded-8 text-label">
              Joining as <strong>{user.displayName}</strong>
              {displayName !== user.displayName && (
                <span> (you can change your name above)</span>
              )}
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input-field mt-2"
                placeholder="Or type a different name"
                maxLength={50}
              />
            </div>
          )}

          <button
            onClick={handleJoin}
            disabled={joining}
            className="btn-primary w-full py-3"
          >
            {joining ? 'Joining...' : 'Join Quiz'}
          </button>

          <p className="text-xs text-text-secondary text-center">
            You can answer only while each question is active.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <JoinContent />
    </Suspense>
  );
}
