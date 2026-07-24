'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function CreateQuizPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    defaultTimeLimit: 30,
    defaultPoints: 100,
    rules: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/quiz/${data.data.id}/edit`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar>
        <Link href="/dashboard" className="btn-ghost text-sm">← Dashboard</Link>
      </Navbar>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <h2 className="text-title font-bold mb-6">Create New Quiz</h2>

        {error && (
          <div className="bg-danger-100 text-danger-600 p-3 rounded-8 text-label mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="card space-y-5">
          <div>
            <label className="label-text">Quiz Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-field"
              required
              placeholder="e.g., JavaScript Fundamentals"
            />
          </div>

          <div>
            <label className="label-text">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field min-h-[80px]"
              placeholder="What is this quiz about?"
              rows={3}
            />
          </div>

          <div>
            <label className="label-text">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input-field"
            >
              <option value="">Select a category...</option>
              <option value="Technology">Technology</option>
              <option value="Science">Science</option>
              <option value="History">History</option>
              <option value="Geography">Geography</option>
              <option value="Food & Cooking">Food & Cooking</option>
              <option value="Music">Music</option>
              <option value="Movies & TV">Movies & TV</option>
              <option value="Sports">Sports</option>
              <option value="Literature">Literature</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Language">Language</option>
              <option value="Art">Art</option>
              <option value="General Knowledge">General Knowledge</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-text">Default Time Limit (seconds)</label>
              <input
                type="number"
                value={form.defaultTimeLimit}
                onChange={(e) => setForm({ ...form, defaultTimeLimit: parseInt(e.target.value) || 30 })}
                className="input-field"
                min={5}
                max={300}
              />
            </div>
            <div>
              <label className="label-text">Default Points Per Question</label>
              <input
                type="number"
                value={form.defaultPoints}
                onChange={(e) => setForm({ ...form, defaultPoints: parseInt(e.target.value) || 100 })}
                className="input-field"
                min={1}
                max={1000}
              />
            </div>
          </div>

          <div>
            <label className="label-text">Rules (shown to participants)</label>
            <textarea
              value={form.rules}
              onChange={(e) => setForm({ ...form, rules: e.target.value })}
              className="input-field min-h-[80px]"
              placeholder="Optional rules for participants"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Link href="/dashboard" className="btn-secondary">Cancel</Link>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Creating...' : 'Create Quiz & Add Questions'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
