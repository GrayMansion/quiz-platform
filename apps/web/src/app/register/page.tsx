'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', displayName: '', role: 'PARTICIPANT' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-8">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-2">Create an account</h1>
        <p className="text-label text-text-secondary text-center mb-6">
          Join as a participant or organizer
        </p>

        {error && (
          <div className="bg-danger-100 text-danger-600 p-3 rounded-8 text-label mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-text">Display Name</label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              className="input-field"
              required
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="label-text">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input-field"
              required
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="label-text">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input-field"
              required
              placeholder="Min 6 characters"
            />
          </div>
          <div>
            <label className="label-text">Role</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  value="PARTICIPANT"
                  checked={form.role === 'PARTICIPANT'}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="accent-primary-600"
                />
                <span className="text-label">Participant</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  value="ORGANIZER"
                  checked={form.role === 'ORGANIZER'}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="accent-primary-600"
                />
                <span className="text-label">Organizer</span>
              </label>
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-label text-text-secondary text-center mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-primary-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
