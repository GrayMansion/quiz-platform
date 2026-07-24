'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

interface Option {
  id?: string;
  text: string;
  imageUrl?: string;
  isCorrect: boolean;
  position: number;
}

interface Question {
  id?: string;
  position: number;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
  text: string;
  imageUrl?: string;
  timeLimit?: number;
  points?: number;
  options: Option[];
}

interface QuizData {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  defaultTimeLimit: number;
  defaultPoints: number;
  rules: string | null;
  questions: Question[];
}

export default function EditQuizPage() {
  const params = useParams();
  const router = useRouter();
  const quizId = params.id as string;

  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // New question form
  const [newQuestion, setNewQuestion] = useState<Question>({
    position: 0,
    type: 'SINGLE_CHOICE',
    text: '',
    options: [
      { text: '', isCorrect: false, position: 0 },
      { text: '', isCorrect: true, position: 1 },
      { text: '', isCorrect: false, position: 2 },
      { text: '', isCorrect: false, position: 3 },
    ],
  });

  // Track which questions are expanded
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  // Quiz settings form
  const [settings, setSettings] = useState({
    title: '',
    description: '',
    category: '',
    defaultTimeLimit: 30,
    defaultPoints: 100,
    rules: '',
  });

  const loadQuiz = useCallback(async () => {
    try {
      const res = await fetch(`/api/quizzes/${quizId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQuiz(data.data);
      setSettings({
        title: data.data.title,
        description: data.data.description || '',
        category: data.data.category || '',
        defaultTimeLimit: data.data.defaultTimeLimit,
        defaultPoints: data.data.defaultPoints,
        rules: data.data.rules || '',
      });
      setNewQuestion((prev) => ({
        ...prev,
        position: data.data.questions.length,
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => { loadQuiz(); }, [loadQuiz]);

  async function addQuestion() {
    // Validate
    if (!newQuestion.text.trim()) { setError('Question text is required'); return; }
    const filledOptions = newQuestion.options.filter((o) => o.text.trim());
    const hasEmpty = newQuestion.options.some((o) => !o.text.trim());
    if (hasEmpty) { setError('All options must be filled in'); return; }
    if (filledOptions.length < 2) { setError('At least 2 options required'); return; }
    if (!newQuestion.options.some((o) => o.isCorrect)) { setError('Mark a correct answer'); return; }

    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/quizzes/${quizId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: newQuestion.position,
          type: newQuestion.type,
          text: newQuestion.text,
          imageUrl: newQuestion.imageUrl || undefined,
          timeLimit: newQuestion.timeLimit || undefined,
          points: newQuestion.points || undefined,
          options: filledOptions.map((o, i) => ({
            text: o.text,
            isCorrect: o.isCorrect,
            position: i,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Reset and reload
      setNewQuestion({
        position: (quiz?.questions.length || 0) + 1,
        type: 'SINGLE_CHOICE',
        text: '',
        options: [
          { text: '', isCorrect: false, position: 0 },
          { text: '', isCorrect: true, position: 1 },
          { text: '', isCorrect: false, position: 2 },
          { text: '', isCorrect: false, position: 3 },
        ],
      });
      setSuccess('Question added!');
      setTimeout(() => setSuccess(''), 2000);
      await loadQuiz();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestion(questionId: string) {
    if (!confirm('Delete this question?')) return;
    try {
      await fetch(`/api/questions/${questionId}`, { method: 'DELETE' });
      await loadQuiz();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function updateSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`/api/quizzes/${quizId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSuccess('Settings saved!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!quiz?.questions.length) {
      setError('Add at least one question before publishing');
      return;
    }
    setSaving(true);
    try {
      await fetch(`/api/quizzes/${quizId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PUBLISHED' }),
      });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-background">
      <Navbar>
        {quiz?.status !== 'PUBLISHED' && quiz?.questions && quiz.questions.length > 0 && (
          <Link href={`/quiz/${quizId}/launch`} className="btn-primary text-sm">🚀 Launch Session</Link>
        )}
      </Navbar>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {error && <div className="bg-danger-100 text-danger-600 p-3 rounded-8 mb-4">{error}</div>}
        {success && <div className="bg-success-100 text-success-600 p-3 rounded-8 mb-4">{success}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Settings */}
          <div>
            <div className="card mb-6">
              <h3 className="font-semibold text-lg mb-4">Quiz Settings</h3>
              <form onSubmit={updateSettings} className="space-y-4">
                <div>
                  <label className="label-text">Title</label>
                  <input
                    type="text"
                    value={settings.title}
                    onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="label-text">Description</label>
                  <textarea
                    value={settings.description}
                    onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                    className="input-field"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="label-text">Category</label>
                  <select
                    value={settings.category}
                    onChange={(e) => setSettings({ ...settings, category: e.target.value })}
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-text">Time (sec)</label>
                    <input
                      type="number"
                      value={settings.defaultTimeLimit}
                      onChange={(e) => setSettings({ ...settings, defaultTimeLimit: parseInt(e.target.value) || 30 })}
                      className="input-field"
                      min={5}
                    />
                  </div>
                  <div>
                    <label className="label-text">Points</label>
                    <input
                      type="number"
                      value={settings.defaultPoints}
                      onChange={(e) => setSettings({ ...settings, defaultPoints: parseInt(e.target.value) || 100 })}
                      className="input-field"
                      min={1}
                    />
                  </div>
                </div>
                <div>
                  <label className="label-text">Rules</label>
                  <textarea
                    value={settings.rules}
                    onChange={(e) => setSettings({ ...settings, rules: e.target.value })}
                    className="input-field"
                    rows={2}
                  />
                </div>
                <button type="submit" disabled={saving} className="btn-secondary">
                  Save Settings
                </button>
              </form>
            </div>

            {/* Question list */}
            <div className="card">
              <h3 className="font-semibold text-lg mb-4">
                Questions ({quiz?.questions.length || 0})
              </h3>
              {quiz?.questions.length === 0 ? (
                <p className="text-text-secondary text-label">No questions yet. Add one on the right.</p>
              ) : (
                <div className="space-y-2">
                  {quiz?.questions.map((q, i) => {
                    const isExpanded = expandedQuestions.has(q.id!);
                    return (
                    <div key={q.id} className="border border-border rounded-8 overflow-hidden">
                      <div className="flex items-center justify-between p-3">
                        <button
                          onClick={() => {
                            const next = new Set(expandedQuestions);
                            if (isExpanded) next.delete(q.id!);
                            else next.add(q.id!);
                            setExpandedQuestions(next);
                          }}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <svg className={`w-3 h-3 text-text-secondary transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="text-xs text-text-secondary">Q{i + 1}</span>
                            <p className="font-medium truncate">{q.text}</p>
                          </div>
                          <span className="text-xs text-text-secondary ml-6">
                            {q.type === 'SINGLE_CHOICE' ? 'Single choice' : 'Multiple choice'}
                            {q.timeLimit && ` · ${q.timeLimit}s`}
                            {q.points && ` · ${q.points} pts`}
                          </span>
                        </button>
                        <button
                          onClick={() => deleteQuestion(q.id!)}
                          className="btn-ghost text-sm text-danger-600 ml-2"
                        >
                          Delete
                        </button>
                      </div>
                      {isExpanded && q.options && (
                        <div className="border-t border-border px-3 py-2 bg-gray-50">
                          {q.options.map((o: any, j: number) => (
                            <div key={o.id} className={`text-label py-1 flex items-center gap-2 ${o.isCorrect ? 'text-success-600 font-medium' : 'text-text-secondary'}`}>
                              <span>{o.isCorrect ? '✓' : '○'}</span>
                              <span>{o.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Add Question */}
          <div>
            <div className="card">
              <h3 className="font-semibold text-lg mb-4">Add Question</h3>
              <div className="space-y-4">
                <div>
                  <label className="label-text">Question Type</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewQuestion({ ...newQuestion, type: 'SINGLE_CHOICE' })}
                      className={`flex-1 p-2 rounded-8 border text-label font-medium transition-colors ${
                        newQuestion.type === 'SINGLE_CHOICE'
                          ? 'border-primary-600 bg-primary-100 text-primary-600'
                          : 'border-border'
                      }`}
                    >
                      Single Choice
                    </button>
                    <button
                      onClick={() => setNewQuestion({ ...newQuestion, type: 'MULTIPLE_CHOICE' })}
                      className={`flex-1 p-2 rounded-8 border text-label font-medium transition-colors ${
                        newQuestion.type === 'MULTIPLE_CHOICE'
                          ? 'border-primary-600 bg-primary-100 text-primary-600'
                          : 'border-border'
                      }`}
                    >
                      Multiple Choice
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label-text">Question Text</label>
                  <textarea
                    value={newQuestion.text}
                    onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })}
                    className="input-field"
                    rows={3}
                    placeholder="Enter your question..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-text">Time Limit (sec, optional)</label>
                    <input
                      type="number"
                      value={newQuestion.timeLimit || ''}
                      onChange={(e) => setNewQuestion({ ...newQuestion, timeLimit: parseInt(e.target.value) || undefined })}
                      className="input-field"
                      placeholder={`Default: ${quiz?.defaultTimeLimit || 30}`}
                    />
                  </div>
                  <div>
                    <label className="label-text">Points (optional)</label>
                    <input
                      type="number"
                      value={newQuestion.points || ''}
                      onChange={(e) => setNewQuestion({ ...newQuestion, points: parseInt(e.target.value) || undefined })}
                      className="input-field"
                      placeholder={`Default: ${quiz?.defaultPoints || 100}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="label-text">Answer Options</label>
                  <p className="text-xs text-text-secondary mb-2">
                    Mark correct answer(s) with the checkbox.
                    {newQuestion.type === 'MULTIPLE_CHOICE' && ' Select all that are correct.'}
                  </p>
                  {newQuestion.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <input
                        type={newQuestion.type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                        name="correctAnswer"
                        checked={opt.isCorrect}
                        onChange={() => {
                          const newOptions = [...newQuestion.options];
                          if (newQuestion.type === 'SINGLE_CHOICE') {
                            newOptions.forEach((o, j) => (o.isCorrect = j === i));
                          } else {
                            newOptions[i].isCorrect = !newOptions[i].isCorrect;
                          }
                          setNewQuestion({ ...newQuestion, options: newOptions });
                        }}
                        className="accent-primary-600"
                      />
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const newOptions = [...newQuestion.options];
                          newOptions[i].text = e.target.value;
                          setNewQuestion({ ...newQuestion, options: newOptions });
                        }}
                        className="input-field"
                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      />
                      {newQuestion.options.length > 2 && (
                        <button
                          onClick={() => {
                            const newOptions = newQuestion.options.filter((_, j) => j !== i);
                            setNewQuestion({ ...newQuestion, options: newOptions });
                          }}
                          className="flex-shrink-0 w-6 h-6 rounded-full bg-danger-100 text-danger-600 hover:bg-danger-600 hover:text-white flex items-center justify-center text-xs font-bold transition-colors"
                          title="Remove option"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setNewQuestion({
                        ...newQuestion,
                        options: [
                          ...newQuestion.options,
                          { text: '', isCorrect: false, position: newQuestion.options.length },
                        ],
                      })
                    }
                    className="btn-ghost text-sm text-primary-600"
                  >
                    + Add Option
                  </button>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={addQuestion} disabled={saving} className="btn-primary flex-1">
                    {saving ? 'Adding...' : 'Add Question'}
                  </button>
                </div>
              </div>
            </div>

            {quiz?.status !== 'PUBLISHED' && quiz?.questions && quiz.questions.length > 0 && (
              <button
                onClick={handlePublish}
                className="btn-primary w-full mt-4 py-3"
              >
                ✅ Publish Quiz & Go to Dashboard
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
