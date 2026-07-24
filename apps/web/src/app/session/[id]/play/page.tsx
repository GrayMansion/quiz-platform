'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

function PlayContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const displayName = searchParams.get('name') || 'Player';
  const roomCode = searchParams.get('code') || '';
  const socketRef = useRef<Socket | null>(null);

  const [connected, setConnected] = useState(false);
  const [question, setQuestion] = useState<any>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [feedback, setFeedback] = useState<any>(null);
  const [questionResult, setQuestionResult] = useState<any>(null);
  const [lastOptions, setLastOptions] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [sessionState, setSessionState] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [score, setScore] = useState(0);
  const [rank, setRank] = useState<number | null>(null);
  // Question navigator: index -> 'correct' | 'incorrect' | 'current' | 'unanswered'
  const [questionStatuses, setQuestionStatuses] = useState<Record<number, string>>({});
  const [startCountdown, setStartCountdown] = useState<number | null>(null);
  const currentQuestionRef = useRef(0);

  const sessionId = typeof window !== 'undefined'
    ? window.location.pathname.split('/').filter(Boolean)[1]
    : '';

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    fetch('/api/auth/socket-token')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const token = data.token || '';
        const s = io(WS_URL, { withCredentials: true, auth: token ? { token } : {} });
        socketRef.current = s;

        s.on('connect', () => setConnected(true));
        s.on('disconnect', () => setConnected(false));

        const storedCode = sessionStorage.getItem(`session_code_${sessionId}`) || roomCode;
        const storedParticipantId = sessionStorage.getItem(`participant_${sessionId}`) || '';
        s.emit('session:join', { roomCode: storedCode, displayName, participantId: storedParticipantId }, (res: any) => {
          if (res?.error && !cancelled) setError(res.error);
        });

        s.on('session:state', (payload) => {
          if (cancelled) return;
          setSessionState(payload);
          // Store participantId for future reconnections
          if (payload.participantId) {
            sessionStorage.setItem(`participant_${sessionId}`, payload.participantId);
          }
          if (payload.currentQuestion) {
            currentQuestionRef.current = payload.currentQuestion.questionNumber - 1;
            setQuestion(payload.currentQuestion);
            setSubmitted(payload.hasSubmitted);
            setLastOptions(payload.currentQuestion.options || []);
            const remaining = Math.max(0, payload.currentQuestion.deadlineAt - Date.now());
            setTimeLeft(remaining);
            setTotalTime(remaining);
            // Mark this question as current
            setQuestionStatuses((prev) => ({
              ...prev,
              [payload.currentQuestionIndex]: 'current',
            }));
          }
        });

        s.on('question:open', (payload) => {
          if (cancelled) return;
          currentQuestionRef.current = payload.questionNumber - 1;
          setQuestion(payload);
          setSelectedOptions([]);
          setSubmitted(false);
          setFeedback(null);
          setQuestionResult(null);
          setLastOptions(payload.options || []);
          setError('');
          const remaining = payload.deadlineAt - Date.now();
          setTimeLeft(remaining);
          setTotalTime(remaining);
          setQuestionStatuses((prev) => ({
            ...prev,
            [payload.questionNumber - 1]: 'current',
          }));
        });

        s.on('answer:accepted', () => { if (!cancelled) setSubmitted(true); });

        s.on('question:closed', ({ leaderboard: lb }: any) => {
          if (cancelled) return;
          setFeedback({ closed: true, leaderboard: lb });
          setQuestion(null);
          setTimeLeft(0);
        });

        s.on('question:result', (result) => {
          if (cancelled) return;
          setQuestionResult(result);
          setQuestionStatuses((prev) => ({
            ...prev,
            [currentQuestionRef.current]: result.isCorrect ? 'correct' : 'incorrect',
          }));
        });

        s.on('leaderboard:update', (payload) => {
          if (cancelled) return;
          setLeaderboard(payload);
          // Find current player's rank and score
          const me = payload.find((e: any) => e.displayName === displayName);
          if (me) {
            setScore(me.totalScore);
            setRank(me.rank);
          }
        });

        s.on('session:finished', () => {
          router.push(`/session/${sessionId}/results?code=${roomCode}`);
        });

        s.on('countdown', (data) => {
          if (cancelled) return;
          setFeedback((prev: any) => ({ ...prev, countdown: data.seconds, isLastQuestion: data.isLastQuestion }));
        });

        s.on('countdown:start', (data) => {
          if (cancelled) return;
          setStartCountdown(data.count);
        });

        s.on('session:error', (payload) => {
          if (cancelled) return;
          setError(payload.message);
        });
      });

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
    };
  }, [sessionId, roomCode, displayName]);

  // Timer
  useEffect(() => {
    if (!question || submitted || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 100) { clearInterval(interval); return 0; }
        return prev - 100;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [question, submitted, timeLeft]);

  const handleSelectOption = (optionId: string) => {
    if (submitted) return;
    if (question?.type === 'SINGLE_CHOICE') {
      setSelectedOptions([optionId]);
    } else {
      setSelectedOptions((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
      );
    }
  };

  const handleSubmit = () => {
    const s = socketRef.current;
    if (!s || !question || selectedOptions.length === 0) return;
    s.emit('answer:submit', {
      questionId: question.questionId,
      selectedOptionIds: selectedOptions,
    }, (res: any) => { if (res?.error) setError(res.error); });
  };

  const formatTime = (ms: number) => Math.ceil(ms / 1000).toString().padStart(2, '0');
  const timerPercent = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
  const timerUrgent = timeLeft <= 10000 && timeLeft > 5000;
  const timerCritical = timeLeft <= 5000;
  const isMultiple = question?.type === 'MULTIPLE_CHOICE';
  const totalQuestions = sessionState?.totalQuestions || question?.totalQuestions || 0;
  const currentQNum = question?.questionNumber || 0;
  const progressPct = totalQuestions > 0 ? ((currentQNum - 1) / totalQuestions) * 100 : 0;

  if (!sessionState && !question && !feedback) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Loading quiz...</p>
        </div>
      </div>
    );
  }

  const total = totalQuestions || 10;
  const questionNumbers = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Start countdown overlay */}
      {startCountdown !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-8xl font-bold text-white animate-pulse" key={startCountdown}>{startCountdown}</div>
            <p className="text-white/80 text-lg mt-4">Get ready...</p>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="border-b border-border bg-surface">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <span className="font-bold text-primary-600">{sessionState?.quizTitle || 'Quiz'}</span>
          <div className="flex items-center gap-4">
            {question && !submitted && (
              <div className={`text-xl font-mono font-bold px-4 py-1 rounded-8 ${
                timerCritical ? 'bg-danger-100 text-danger-600' :
                timerUrgent ? 'bg-yellow-100 text-yellow-700' :
                'bg-primary-100 text-primary-600'
              }`}>⏱ {formatTime(timeLeft)}s</div>
            )}
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success-600' : 'bg-danger-600'}`} />
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-border">
          <div className={`h-full transition-all duration-300 ${timerCritical ? 'bg-danger-600' : timerUrgent ? 'bg-yellow-500' : 'bg-primary-600'}`}
            style={{ width: `${Math.min(100, Math.max(0, Math.max(timerPercent, progressPct)))}%` }} />
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-6 py-6 w-full">
        {error && <div className="bg-danger-100 text-danger-600 p-3 rounded-8 mb-4">{error}</div>}

        <div className="flex gap-6">
          {/* LEFT: Question & answers */}
          <div className="flex-1 min-w-0">
            {question && !feedback && (
              <div>
                <div className="mb-1 text-label text-text-secondary">
                  Question {question.questionNumber} / {totalQuestions}
                </div>
                <div className="card mb-6">
                  <h2 className="text-lg font-semibold mb-4">{question.text}</h2>
                  {question.imageUrl && (
                    <img src={question.imageUrl} alt="Question" className="max-h-[400px] rounded-8 mb-4 object-contain bg-gray-50" />
                  )}
                  <p className="text-label text-text-secondary">
                    {isMultiple ? 'Select all correct answers' : 'Select one answer'} · {question.points} points
                  </p>
                </div>

                <div className="space-y-3 mb-6">
                  {question.options?.map((opt: any) => {
                    const isSelected = selectedOptions.includes(opt.id);
                    return (
                      <button key={opt.id}
                        onClick={() => handleSelectOption(opt.id)}
                        disabled={submitted || timeLeft <= 0}
                        className={`w-full text-left p-4 rounded-12 border-2 transition-all ${
                          isSelected ? 'border-primary-600 bg-primary-100' : 'border-border bg-surface hover:border-primary-300'
                        } ${submitted || timeLeft <= 0 ? 'opacity-60 cursor-not-allowed' : ''}`}>
                        <div className="flex items-center gap-3">
                          {isMultiple ? (
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                              isSelected ? 'border-primary-600 bg-primary-600' : 'border-border'
                            }`}>
                              {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                          ) : (
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              isSelected ? 'border-primary-600 bg-primary-600' : 'border-border'
                            }`}>
                              {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                            </div>
                          )}
                          <span className="font-medium">{opt.text}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-center mb-8">
                  <button onClick={handleSubmit}
                    disabled={submitted || selectedOptions.length === 0 || timeLeft <= 0}
                    className="btn-primary px-16 py-3 text-lg rounded-12">
                    {submitted ? 'Answer Locked — Waiting...' : 'Submit Answer'}
                  </button>
                </div>
                {submitted && <p className="text-center text-success-600 text-label -mt-4 mb-4">Answer locked. Waiting for other participants...</p>}
              </div>
            )}

            {/* Feedback */}
            {feedback && (
              <div className="space-y-6">
                <div className={`card border-2 ${questionResult?.isCorrect ? 'border-success-600 bg-success-50' : 'border-danger-600 bg-danger-50'}`}>
                  <h3 className={`text-lg font-semibold mb-3 ${questionResult?.isCorrect ? 'text-success-600' : 'text-danger-600'}`}>
                    {questionResult?.isCorrect ? '✅ Correct!' : '❌ Incorrect'}
                  </h3>
                  {questionResult ? (
                    <>
                      {questionResult.isCorrect ? (
                        <p className="text-success-600 font-medium text-lg">+{questionResult.awardedPoints} points</p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-text-secondary text-label">The correct answer was:</p>
                          {(questionResult.correctOptions || lastOptions?.filter((o: any) => questionResult.correctOptionIds?.includes(o.id)) || []).map((o: any) => (
                            <div key={o.id} className="bg-success-100 text-success-700 p-3 rounded-8 font-medium border border-success-300">{o.text}</div>
                          ))}
                          {questionResult.selectedOptionIds?.length > 0 && (
                            <>
                              <p className="text-text-secondary text-label mt-3">You selected:</p>
                              {(questionResult.allOptions || lastOptions || []).filter((o: any) => questionResult.selectedOptionIds.includes(o.id)).map((o: any) => (
                                <div key={o.id} className={`p-3 rounded-8 font-medium border ${
                                  (questionResult.correctOptionIds || []).includes(o.id)
                                    ? 'bg-success-100 text-success-700 border-success-300'
                                    : 'bg-danger-100 text-danger-700 border-danger-300'
                                }`}>{o.text}</div>
                              ))}
                            </>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-text-secondary">You did not submit an answer in time.</p>
                  )}
                </div>

                {feedback.leaderboard?.length > 0 && (
                  <div className="card">
                    <h3 className="font-semibold mb-3">Leaderboard</h3>
                    <div className="space-y-2">
                      {feedback.leaderboard.slice(0, 10).map((entry: any, i: number) => (
                        <div key={i} className={`flex items-center justify-between p-2 rounded-8 ${entry.displayName === displayName ? 'bg-primary-100 border border-primary-300' : ''}`}>
                          <div className="flex items-center gap-3">
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${entry.rank===1?'bg-yellow-400 text-white':entry.rank===2?'bg-gray-300 text-gray-700':entry.rank===3?'bg-orange-300 text-white':'bg-gray-100 text-text-secondary'}`}>{entry.rank}</span>
                            <span className="font-medium">{entry.displayName}{entry.displayName===displayName&&<span className="ml-2 text-xs bg-primary-600 text-white px-1.5 py-0.5 rounded-4">You</span>}</span>
                          </div>
                          <span className="font-bold text-primary-600">{entry.totalScore} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-center text-text-secondary text-label">
                  {feedback?.countdown
                    ? (feedback?.isLastQuestion
                      ? `The results will be shown in ${feedback.countdown} seconds`
                      : `Next question starts in ${feedback.countdown} seconds`)
                    : 'Waiting for next question...'}
                </p>
              </div>
            )}

            {timeLeft <= 0 && question && !submitted && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="card text-center max-w-sm">
                  <div className="text-4xl mb-3">⏰</div>
                  <h3 className="text-xl font-bold mb-2">Time&apos;s Up!</h3>
                  <p className="text-text-secondary">The answer window has closed.</p>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Sidebar */}
          <div className="w-64 flex-shrink-0 hidden lg:block">
            {/* Score + Rank */}
            <div className="card mb-4 text-center">
              <div className="text-sm text-text-secondary mb-1">Your Score</div>
              <div className="text-3xl font-bold text-primary-600">{score}</div>
              {rank && (
                <div className="text-sm font-medium text-success-600 mt-1">
                  {rank === 1 ? '🥇 1ST' : rank === 2 ? '🥈 2ND' : rank === 3 ? '🥉 3RD' : `#${rank}`} Place
                </div>
              )}
              <div className="text-xs text-text-secondary mt-1">{displayName}</div>
            </div>

            {/* Question Navigator */}
            <div className="card">
              <div className="text-sm font-semibold text-text-secondary mb-3">Questions</div>
              <div className="space-y-1.5">
                {questionNumbers.map((num) => {
                  const idx = num - 1;
                  const status = questionStatuses[idx] || 'unanswered';
                  const isCurrent = status === 'current' || (question && currentQNum === num);
                  return (
                    <div key={num}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-8 text-label ${
                        isCurrent ? 'bg-primary-100 font-semibold' : ''
                      }`}>
                      <span className={`w-5 h-5 rounded flex items-center justify-center text-xs flex-shrink-0 ${
                        status === 'correct' ? 'bg-success-100 text-success-600' :
                        status === 'incorrect' ? 'bg-danger-100 text-danger-600' :
                        isCurrent ? 'bg-primary-200 text-primary-600 border border-primary-400' :
                        'bg-gray-100 text-text-secondary'
                      }`}>
                        {status === 'correct' ? '✔' :
                         status === 'incorrect' ? '✘' :
                         isCurrent ? '●' : ''}
                      </span>
                      <span className="truncate">Question {num}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <PlayContent />
    </Suspense>
  );
}
