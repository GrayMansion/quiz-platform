'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';

const ITEMS_PER_PAGE = 5;

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [orgData, setOrgData] = useState<any>(null);
  const [partItems, setPartItems] = useState<any[]>([]);
  const [partStats, setPartStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [quizPage, setQuizPage] = useState(1);
  const [sessionPage, setSessionPage] = useState(1);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const meRes = await fetch('/api/me');
      const meData = await meRes.json();
      if (!meData.data) { router.push('/login'); return; }
      setUser(meData.data);

      if (meData.data.role === 'ORGANIZER') {
        const [orgRes, quizRes] = await Promise.all([
          fetch('/api/dashboard/organizer'),
          fetch('/api/quizzes'),
        ]);
        setOrgData((await orgRes.json()).data);
        setQuizzes((await quizRes.json()).data || []);
      } else {
        const partRes = await fetch('/api/dashboard/participant');
        const partJson = await partRes.json();
        setPartItems(partJson.data?.items || []);
        setPartStats(partJson.data?.stats || null);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  async function publishQuiz(quizId: string) {
    await fetch(`/api/quizzes/${quizId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PUBLISHED' }),
    });
    loadData();
  }
  async function archiveQuiz(quizId: string) {
    await fetch(`/api/quizzes/${quizId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ARCHIVED' }),
    });
    loadData();
  }
  async function deleteQuiz(quizId: string) {
    if (!confirm('Delete this quiz?')) return;
    await fetch(`/api/quizzes/${quizId}`, { method: 'DELETE' });
    loadData();
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-text-secondary">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {user?.role === 'ORGANIZER' ? (
          <OrganizerDashboard
            orgData={orgData} quizzes={quizzes}
            quizPage={quizPage} setQuizPage={setQuizPage}
            sessionPage={sessionPage} setSessionPage={setSessionPage}
            onPublish={publishQuiz} onArchive={archiveQuiz} onDelete={deleteQuiz}
          />
        ) : (
          <Suspense fallback={<div className="min-h-[300px] flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>}>
            <ParticipantDashboard items={partItems} stats={partStats} />
          </Suspense>
        )}
      </main>
    </div>
  );
}

// ==================== Organizer Dashboard ====================

function OrganizerDashboard({ orgData, quizzes, quizPage, setQuizPage, sessionPage, setSessionPage, onPublish, onArchive, onDelete }: any) {
  const d = orgData || {};
  const quizStart = (quizPage - 1) * ITEMS_PER_PAGE;
  const pagedQuizzes = quizzes.slice(quizStart, quizStart + ITEMS_PER_PAGE);
  const sessions = d.recentSessions || [];
  const sessStart = (sessionPage - 1) * ITEMS_PER_PAGE;
  const pagedSessions = sessions.slice(sessStart, sessStart + ITEMS_PER_PAGE);

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-title font-bold">Organizer Dashboard</h2>
        <Link href="/quiz/create" className="btn-primary">Create Quiz</Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        <Card value={d.totalQuizzes ?? 0} label="Quizzes made" />
        <Card value={d.completedSessions ?? 0} label="Completed sessions" />
        <Card value={d.totalParticipants ?? 0} label="Total participants" />
        <Card value={`${d.completionRate ?? 0}%`} label="Completion rate" />
        <Card value={`${d.avgPlayerScore ?? 0} pts`} label="Avg. player score" />
      </div>

      {/* Your Quizzes */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Your Quizzes ({quizzes.length})</h3>
        {quizzes.length === 0 ? (
          <div className="card text-center py-12 text-text-secondary">
            <p className="mb-4">No quizzes yet.</p>
            <Link href="/quiz/create" className="btn-primary">Create Quiz</Link>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {pagedQuizzes.map((q: any) => {
                const sc: any = { PUBLISHED: 'bg-success-100 text-success-600', ARCHIVED: 'bg-gray-100 text-text-secondary', DRAFT: 'bg-primary-100 text-primary-600' };
                return (
                  <div key={q.id} className="card flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold">{q.title}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-8 font-medium ${sc[q.status] || ''}`}>{q.status}</span>
                      </div>
                      <p className="text-label text-text-secondary mt-1">{q.questionCount} questions · {q.category || 'No category'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/quiz/${q.id}/edit`} className="btn-ghost text-sm">Edit</Link>
                      {q.status === 'DRAFT' && <button onClick={() => onPublish(q.id)} className="btn-secondary text-sm">Publish</button>}
                      {q.status === 'PUBLISHED' && (
                        <>
                          <Link href={`/quiz/${q.id}/launch`} className="btn-primary text-sm">Launch</Link>
                          <button onClick={() => onArchive(q.id)} className="btn-ghost text-sm">Archive</button>
                        </>
                      )}
                      <button onClick={() => onDelete(q.id)} className="btn-ghost text-sm text-danger-600">Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <Pagination page={quizPage} total={quizzes.length} onChange={setQuizPage} />
          </>
        )}
      </div>

      {/* Recent Sessions */}
      {sessions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Recent Sessions</h3>
          <div className="space-y-2">
            {pagedSessions.map((s: any) => (
              <div key={s.id} className="card flex items-center justify-between">
                <div>
                  <span className="font-medium">{s.quizTitle}</span>
                  <span className="text-label text-text-secondary ml-3">Code: {s.roomCode}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-label text-text-secondary">{s.participantCount} players</span>
                  <span className={`text-xs px-2 py-0.5 rounded-8 ${
                    s.status === 'FINISHED' ? 'bg-success-100 text-success-600' :
                    s.status === 'CANCELLED' ? 'bg-danger-100 text-danger-600' : 'bg-primary-100 text-primary-600'
                  }`}>{s.status}</span>
                  {s.winnerName && s.status === 'FINISHED' && <span className="text-label text-text-secondary">🏆 {s.winnerName}</span>}
                  <Link href={`/session/${s.id}/results`} className="btn-ghost text-sm">View</Link>
                  {s.status === 'LOBBY' && (
                    <button onClick={async () => {
                      if (!confirm(`Close session ${s.roomCode}? Participants will be notified.`)) return;
                      await fetch(`/api/sessions/${s.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'CANCELLED' }) });
                      window.location.reload();
                    }} className="btn-ghost text-sm text-danger-600">Close</button>
                  )}
                  {(s.status === 'FINISHED' || s.status === 'CANCELLED' || s.status === 'LOBBY') && (
                    <button onClick={async () => {
                      if (!confirm(`Delete session ${s.roomCode}? This removes all participant data.`)) return;
                      await fetch(`/api/sessions/${s.id}`, { method: 'DELETE' });
                      window.location.reload();
                    }} className="btn-ghost text-sm text-danger-600">Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Pagination page={sessionPage} total={sessions.length} onChange={setSessionPage} />
        </div>
      )}
    </>
  );
}

// ==================== Participant Dashboard ====================

function ParticipantDashboard({ items, stats }: { items: any[]; stats: any }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageFromUrl = parseInt(searchParams.get('page') || '1');
  const page = isNaN(pageFromUrl) || pageFromUrl < 1 ? 1 : pageFromUrl;

  if (!stats) {
    return (
      <>
        <h2 className="text-title font-bold mb-8">My Dashboard</h2>
        <div className="card text-center py-12">
          <p className="text-text-secondary mb-4">No quiz history yet. Join a quiz to get started!</p>
          <Link href="/" className="btn-primary">Join a Quiz</Link>
        </div>
      </>
    );
  }

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * ITEMS_PER_PAGE;
  const pagedItems = items.slice(start, start + ITEMS_PER_PAGE);
  const total = stats.totalParticipantCount || 1;

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) params.delete('page');
    else params.set('page', String(p));
    router.push(`/dashboard?${params.toString()}`, { scroll: false });
  };

  const rankStyle = (rank: number) => {
    if (rank === 1) return 'border-l-4 border-yellow-400 bg-yellow-50/50';
    if (rank === 2) return 'border-l-4 border-gray-300 bg-gray-50/70';
    if (rank === 3) return 'border-l-4 border-orange-400 bg-orange-50/40';
    return '';
  };

  return (
    <>
      <h2 className="text-title font-bold mb-8">My Dashboard</h2>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        <Card value={stats.quizzesCompleted} label="Quizzes finished" />
        <Card value={`${stats.avgScore} pts`} label="Average score" />
        <Card value={`${stats.correctAnswerRate}%`} label="Correct-answer rate" />
        <Card value={`${stats.bestScore} pts`} label="Best score" />
        <Card value={`#${stats.avgRank} / ${total}`} label="Average rank" />
      </div>

      {/* History */}
      <h3 className="text-lg font-semibold mb-4">History</h3>
      {items.length === 0 ? (
        <div className="card text-center py-12 text-text-secondary">
          <p>No completed sessions yet.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {pagedItems.map((p) => (
              <div key={p.sessionId} className={`card flex items-center justify-between ${rankStyle(p.rank)}`}>
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    p.rank === 1 ? 'bg-yellow-400 text-white' :
                    p.rank === 2 ? 'bg-gray-300 text-gray-700' :
                    p.rank === 3 ? 'bg-orange-300 text-white' :
                    'bg-gray-100 text-text-secondary'
                  }`}>#{p.rank}</span>
                  <div>
                    <h4 className="font-semibold">{p.quizTitle}</h4>
                    <p className="text-label text-text-secondary">
                      Code: {p.roomCode} · {p.completedAt ? new Date(p.completedAt).toLocaleDateString() : 'In progress'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center"><div className="font-bold text-lg">{p.totalScore} pts</div><div className="text-xs text-text-secondary">Score</div></div>
                  <div className="text-center"><div className="font-bold text-lg">{p.correctCount}/{p.totalQuestions}</div><div className="text-xs text-text-secondary">Correct</div></div>
                  <Link href={`/session/${p.sessionId}/results`} className="btn-ghost text-sm">View</Link>
                  <button onClick={async () => {
                    if (!confirm('Remove this session from your history?')) return;
                    await fetch(`/api/sessions/${p.sessionId}/hide`, { method: 'POST' });
                    window.location.reload();
                  }} className="btn-ghost text-sm text-danger-600">Remove</button>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button onClick={() => setPage(safePage - 1)} disabled={safePage <= 1}
                className="px-3 py-1 rounded-8 text-label border border-border hover:bg-gray-50 disabled:opacity-30">‹ Prev</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded-8 text-label ${p === safePage ? 'bg-primary-600 text-white' : 'border border-border hover:bg-gray-50'}`}>{p}</button>
              ))}
              <button onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages}
                className="px-3 py-1 rounded-8 text-label border border-border hover:bg-gray-50 disabled:opacity-30">Next ›</button>
            </div>
          )}
          <p className="text-center text-xs text-text-secondary mt-2">Page {safePage} of {totalPages}</p>
        </>
      )}
    </>
  );
}

// ==================== Shared components ====================

function Card({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="card text-center py-4">
      <div className="text-2xl font-bold text-primary-600">{value}</div>
      <div className="text-xs text-text-secondary mt-1">{label}</div>
    </div>
  );
}

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  if (totalPages <= 1) return null;
  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);

  return (
    <div className="mt-4">
      <div className="flex items-center justify-center gap-2">
        <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1}
          className="px-3 py-1 rounded-8 text-label border border-border hover:bg-gray-50 disabled:opacity-30">‹ Prev</button>
        {pages.map((p) => (
          <button key={p} onClick={() => onChange(p)}
            className={`px-3 py-1 rounded-8 text-label ${p === page ? 'bg-primary-600 text-white' : 'border border-border hover:bg-gray-50'}`}>{p}</button>
        ))}
        <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
          className="px-3 py-1 rounded-8 text-label border border-border hover:bg-gray-50 disabled:opacity-30">Next ›</button>
      </div>
      <p className="text-center text-xs text-text-secondary mt-2">Page {page} of {totalPages}</p>
    </div>
  );
}
