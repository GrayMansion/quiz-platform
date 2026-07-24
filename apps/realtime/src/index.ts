import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('JWT_SECRET env variable is required'); })() : 'dev-secret-change-me');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Internal: notify connected participants of session cancellation
app.post('/internal/cancel-session', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });
  console.log(`[INTERNAL] Cancelling session ${sessionId}`);

  // Notify all connected participants
  io.to(`session:${sessionId}`).emit('session:error', {
    code: 'SESSION_CANCELLED',
    message: 'The organizer has closed this session.',
  });

  // Clear timers
  const liveState = liveSessions.get(sessionId);
  if (liveState?.timerId) clearTimeout(liveState.timerId);
  liveSessions.delete(sessionId);
  clearLobbyTimeout(sessionId);
  const aaTimer = autoAdvanceTimers.get(sessionId);
  if (aaTimer) { clearTimeout(aaTimer); autoAdvanceTimers.delete(sessionId); }

  res.json({ ok: true });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ========== In-memory live session state ==========

interface LiveQuestionState {
  questionId: string;
  openedAt: number;
  deadlineAt: number;
  timerId: ReturnType<typeof setTimeout> | null;
}

const liveSessions = new Map<string, LiveQuestionState>();
const lobbyTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const autoAdvanceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const startingSessions = new Set<string>(); // sessions in countdown phase
const LOBBY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ========== Auth middleware (optional - guests are allowed) ==========

io.use(async (socket, next) => {
  try {
    // Try cookie first (works with withCredentials), then auth token
    const cookieToken = socket.handshake.headers.cookie?.match(/token=([^;]+)/)?.[1];
    const authToken = socket.handshake.auth?.token;
    const token = cookieToken || authToken;

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (user) {
        (socket as any).userId = user.id;
        (socket as any).userRole = user.role;
        (socket as any).displayName = user.displayName;
        (socket as any).isGuest = false;
        console.log(`[AUTH] Authenticated: ${user.displayName} (${user.role})`);
        return next();
      }
      console.log(`[AUTH] Token valid but user not found: ${decoded.userId}`);
    } else {
      console.log('[AUTH] No token — guest connection');
    }

    // Guest connection — allowed for joining sessions
    (socket as any).isGuest = true;
    (socket as any).userRole = 'PARTICIPANT';
    next();
  } catch (err: any) {
    console.log(`[AUTH] Error: ${err.message} — falling back to guest`);
    (socket as any).isGuest = true;
    (socket as any).userRole = 'PARTICIPANT';
    next();
  }
});

// ========== Socket.IO handlers ==========

io.on('connection', (socket) => {
  const isGuest = (socket as any).isGuest as boolean;
  const userId = (socket as any).userId as string | undefined;
  const userRole = (socket as any).userRole as string;

  console.log(`User connected: ${isGuest ? 'Guest' : (socket as any).displayName} (role: ${userRole})`);

  // Join user's private room if authenticated
  if (userId) {
    socket.join(`user:${userId}`);
  }

  // --- session:join ---
  socket.on('session:join', async (payload: { roomCode: string; displayName?: string; participantId?: string }, callback) => {
    try {
      const code = payload.roomCode.toUpperCase().trim();
      const name = payload.displayName || (socket as any).displayName || 'Guest';
      const isOrganizer = !isGuest && userRole === 'ORGANIZER';
      console.log(`[JOIN] ${name} joining ${code} (isGuest: ${isGuest}, role: ${userRole})`);

      const session = await prisma.quizSession.findUnique({
        where: { roomCode: code },
        include: { quiz: true, participants: true },
      });

      if (!session) {
        return callback({ error: 'Invalid room code' });
      }
      if (session.status === 'FINISHED' || session.status === 'CANCELLED') {
        return callback({ error: 'This session has ended' });
      }

      // Organizers join the room but are NOT tracked as participants
      let participant: any = null;

      if (!isOrganizer) {
        // 1) Check the participantId from the client payload (persisted across page navigations)
        if (payload.participantId) {
          participant = session.participants.find((p) => p.id === payload.participantId);
        }
        // 2) Check this socket's previously stored participantId (same-socket reconnect)
        if (!participant) {
          const socketPid = (socket as any).participantId;
          if (socketPid) {
            participant = session.participants.find((p) => p.id === socketPid);
          }
        }
        // 3) For authenticated users: check by userId (one per user per session)
        if (!participant && !isGuest && userId) {
          participant = session.participants.find((p) => p.userId === userId);
        }
        // 4) For guests: deduplicate by display name within this session
        if (!participant && isGuest) {
          participant = session.participants.find((p) => p.displayName === name);
          if (participant) {
            console.log(`[JOIN] Reused guest participant by name: ${name}`);
          }
        }
        // 5) Create a new participant
        if (!participant) {
          let participantUserId: string;
          if (isGuest) {
            participantUserId = (await getOrCreateGuestUser()).id;
          } else {
            participantUserId = userId!;
          }
          // Don't create if socket already disconnected
          if (!socket.connected) {
            console.log(`[JOIN] Socket disconnected — skipping participant creation`);
            return callback({ error: 'Connection lost, please rejoin' });
          }
          participant = await prisma.sessionParticipant.create({
            data: {
              sessionId: session.id,
              userId: participantUserId,
              displayName: name,
            },
          });
          console.log(`[JOIN] Created participant: ${participant.displayName}`);
        } else {
          console.log(`[JOIN] Reused existing participant: ${participant.displayName}`);
        }
        // Update name if it changed
        if (participant && participant.displayName !== name) {
          participant = await prisma.sessionParticipant.update({
            where: { id: participant.id },
            data: { displayName: name },
          });
        }
      } else {
        console.log(`[JOIN] Organizer — not tracked as participant`);
      }

      // Join session room
      const room = `session:${session.id}`;
      socket.join(room);

      (socket as any).sessionId = session.id;
      (socket as any).participantId = participant?.id || null;
      (socket as any).displayName = name;

      // Build and send state
      await sendSessionState(session.id, socket, participant);

      // Notify room about new participant
      if (!isOrganizer) {
        const allParticipants = await prisma.sessionParticipant.findMany({ where: { sessionId: session.id } });
        socket.to(room).emit('participant:joined', {
          displayName: name,
          participantCount: allParticipants.length,
        });
        // Start/refresh lobby timeout
        if (session.status === 'LOBBY') {
          startLobbyTimeout(session.id);
        }
        // Push updated state to everyone else
        for (const [, s] of io.of('/').sockets) {
          if ((s as any).sessionId === session.id && s.id !== socket.id) {
            const p = (s as any).participantId ? await prisma.sessionParticipant.findUnique({ where: { id: (s as any).participantId } }) : null;
            await sendSessionState(session.id, s, p);
          }
        }
      }

      callback({});
    } catch (err: any) {
      console.error('session:join error:', err);
      callback({ error: err.message || 'Failed to join session' });
    }
  });

  // --- session:start (organizer only) ---
  socket.on('session:start', async (callback) => {
    try {
      if (isGuest || userRole !== 'ORGANIZER') {
        return callback({ error: 'Only organizers can start sessions' });
      }

      const sessionId = (socket as any).sessionId;
      if (!sessionId) {
        return callback({ error: 'Not in a session' });
      }

      const session = await prisma.quizSession.findUnique({
        where: { id: sessionId },
        include: { quiz: true },
      });

      if (!session || session.status !== 'LOBBY') {
        return callback({ error: 'Session is not in lobby' });
      }

      // Require at least one participant
      const participantCount = await prisma.sessionParticipant.count({ where: { sessionId } });
      if (participantCount === 0) {
        return callback({ error: 'At least one participant must join before starting' });
      }

      if (startingSessions.has(sessionId)) {
        return callback({ error: 'Quiz is already starting' });
      }

      startingSessions.add(sessionId);

      await prisma.quizSession.update({
        where: { id: sessionId },
        data: { startedAt: new Date() },
      });

      clearLobbyTimeout(sessionId);

      // Start countdown: broadcast 5-4-3-2-1, then open first question
      const room = `session:${sessionId}`;
      for (let i = 5; i >= 1; i--) {
        setTimeout(() => {
          io.to(room).emit('countdown:start', { count: i, total: 5 });
        }, (5 - i) * 1000);
      }

      setTimeout(async () => {
        startingSessions.delete(sessionId);
        await openQuestion(sessionId);
      }, 5000);

      callback({});
    } catch (err: any) {
      callback({ error: err.message || 'Failed to start session' });
    }
  });

  // --- session:next (organizer only) ---
  socket.on('session:next', async (callback) => {
    try {
      if (isGuest || userRole !== 'ORGANIZER') {
        return callback({ error: 'Only organizers can advance questions' });
      }

      const sessionId = (socket as any).sessionId;
      if (!sessionId) return callback({ error: 'Not in a session' });

      const session = await prisma.quizSession.findUnique({
        where: { id: sessionId },
        include: { quiz: { include: { questions: { orderBy: { position: 'asc' } } } } },
      });

      if (!session) return callback({ error: 'Session not found' });

      const nextIndex = session.currentQuestionIndex + 1;
      if (nextIndex >= session.quiz.questions.length) {
        await finishSession(sessionId);
        return callback({});
      }

      await prisma.quizSession.update({
        where: { id: sessionId },
        data: { currentQuestionIndex: nextIndex, status: 'LOBBY' },
      });

      clearLobbyTimeout(sessionId);
      const aaTimer = autoAdvanceTimers.get(sessionId);
      if (aaTimer) { clearTimeout(aaTimer); autoAdvanceTimers.delete(sessionId); }

      await openQuestion(sessionId);
      callback({});
    } catch (err: any) {
      callback({ error: err.message });
    }
  });

  // --- answer:submit ---
  socket.on('answer:submit', async (payload: { questionId: string; selectedOptionIds: string[] }, callback) => {
    try {
      const sessionId = (socket as any).sessionId;
      const participantId = (socket as any).participantId;
      if (!sessionId || !participantId) {
        return callback({ error: 'Not in a session' });
      }

      const session = await prisma.quizSession.findUnique({ where: { id: sessionId } });
      if (!session || session.status !== 'QUESTION_OPEN') {
        return callback({ error: 'Answers not accepted at this time' });
      }

      // Check deadline
      const liveState = liveSessions.get(sessionId);
      if (liveState && Date.now() > liveState.deadlineAt) {
        return callback({ error: 'Time is up' });
      }

      // Check for duplicate
      const existing = await prisma.response.findFirst({
        where: { participantId, questionId: payload.questionId },
      });
      if (existing) {
        return callback({ error: 'Answer already submitted' });
      }

      // Score the answer
      const question = await prisma.question.findUnique({
        where: { id: payload.questionId },
        include: { options: true },
      });

      if (!question) return callback({ error: 'Question not found' });

      const correctOptionIds = question.options
        .filter((o) => o.isCorrect)
        .map((o) => o.id)
        .sort();
      const selectedIds = [...payload.selectedOptionIds].sort();
      const isCorrect =
        correctOptionIds.length === selectedIds.length &&
        correctOptionIds.every((id, i) => id === selectedIds[i]);

      const points = question.points || 100;
      let awardedPoints = 0;

      if (isCorrect) {
        awardedPoints = points;
        if (liveState && (question.timeLimit || 30)) {
          const timeLimit = question.timeLimit || 30;
          const remaining = liveState.deadlineAt - Date.now();
          const maxBonus = Math.floor(points * 0.2);
          const speedBonus = Math.max(0, Math.floor(maxBonus * (remaining / (timeLimit * 1000))));
          awardedPoints += speedBonus;
        }
      }

      // Save response
      await prisma.response.create({
        data: {
          sessionId,
          participantId,
          questionId: payload.questionId,
          isCorrect,
          awardedPoints,
          selectedOptions: {
            create: payload.selectedOptionIds.map((oid) => ({
              answerOptionId: oid,
            })),
          },
        },
      });

      // Update participant score
      await prisma.sessionParticipant.update({
        where: { id: participantId },
        data: { totalScore: { increment: awardedPoints } },
      });

      socket.emit('answer:accepted', { message: 'Answer submitted' });
      callback({});

      // Broadcast answered count
      const answeredCount = await prisma.response.count({
        where: { sessionId, questionId: payload.questionId },
      });
      const participantCount = await prisma.sessionParticipant.count({ where: { sessionId } });
      io.to(`session:${sessionId}`).emit('participant:joined', {
        displayName: 'answered_update',
        participantCount: `${answeredCount} / ${participantCount} answered`,
      } as any);

      // Close question early if all participants have answered
      if (answeredCount >= participantCount) {
        console.log(`[ANSWER] All ${participantCount} participants answered — closing question early`);
        if (liveState?.timerId) clearTimeout(liveState.timerId);
        await closeQuestion(sessionId);
      }
    } catch (err: any) {
      callback({ error: err.message || 'Failed to submit answer' });
    }
  });

  // --- session:end (organizer only) ---
  socket.on('session:end', async (callback) => {
    try {
      if (isGuest || userRole !== 'ORGANIZER') {
        return callback({ error: 'Only organizers can end sessions' });
      }
      const sessionId = (socket as any).sessionId;
      if (!sessionId) return callback({ error: 'Not in a session' });
      await finishSession(sessionId);
      callback({});
    } catch (err: any) {
      callback({ error: err.message });
    }
  });

  // --- disconnect ---
  socket.on('disconnect', () => {
    const sessionId = (socket as any).sessionId;
    const name = (socket as any).displayName || 'Guest';
    if (sessionId) {
      socket.to(`session:${sessionId}`).emit('participant:left', {
        displayName: name,
        participantCount: 0,
      });
    }
    console.log(`User disconnected: ${name}`);
  });
});

// ========== Guest user helper ==========

async function getOrCreateGuestUser() {
  let guestUser = await prisma.user.findUnique({ where: { email: 'guest@system.internal' } });
  if (!guestUser) {
    guestUser = await prisma.user.create({
      data: {
        email: 'guest@system.internal',
        passwordHash: '__guest__',
        displayName: 'System Guest',
        role: 'PARTICIPANT',
      },
    });
  }
  return guestUser;
}

function startLobbyTimeout(sessionId: string) {
  clearLobbyTimeout(sessionId);
  console.log(`[TIMER] Lobby timeout set for ${sessionId} (${LOBBY_TIMEOUT_MS / 60000} min)`);
  lobbyTimeouts.set(sessionId, setTimeout(async () => {
    console.log(`[TIMER] Lobby timeout fired for ${sessionId} — cancelling session`);
    const session = await prisma.quizSession.findUnique({ where: { id: sessionId } });
    if (session && session.status === 'LOBBY') {
      await prisma.quizSession.update({
        where: { id: sessionId },
        data: { status: 'CANCELLED', endedAt: new Date() },
      });
      io.to(`session:${sessionId}`).emit('session:error', {
        code: 'LOBBY_TIMEOUT',
        message: 'Session cancelled — lobby was idle for 5 minutes.',
      });
      lobbyTimeouts.delete(sessionId);
    }
  }, LOBBY_TIMEOUT_MS));
}

function clearLobbyTimeout(sessionId: string) {
  const existing = lobbyTimeouts.get(sessionId);
  if (existing) {
    clearTimeout(existing);
    lobbyTimeouts.delete(sessionId);
  }
}

// ========== State helper ==========

async function sendSessionState(sessionId: string, socket: any, participant: any) {
  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    include: { quiz: true },
  });
  if (!session) return;

  const questions = await prisma.question.findMany({
    where: { quizId: session.quizId },
    orderBy: { position: 'asc' },
    include: { options: { orderBy: { position: 'asc' } } },
  });

  const allParticipants = await prisma.sessionParticipant.findMany({
    where: { sessionId },
  });

  const currentQuestion = session.status === 'QUESTION_OPEN' && session.currentQuestionIndex < questions.length
    ? questions[session.currentQuestionIndex]
    : null;

  const liveState = liveSessions.get(sessionId);
  let questionPayload = null;
  if (currentQuestion && liveState) {
    questionPayload = {
      questionId: currentQuestion.id,
      questionNumber: session.currentQuestionIndex + 1,
      totalQuestions: questions.length,
      text: currentQuestion.text,
      imageUrl: currentQuestion.imageUrl,
      type: currentQuestion.type as 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE',
      options: currentQuestion.options.map((o) => ({
        id: o.id, text: o.text, imageUrl: o.imageUrl, position: o.position,
      })),
      deadlineAt: liveState.deadlineAt,
      points: currentQuestion.points ?? session.quiz.defaultPoints ?? 100,
    };
  }

  let hasSubmitted = false;
  if (currentQuestion && participant) {
    const existing = await prisma.response.findFirst({
      where: { participantId: participant.id, questionId: currentQuestion.id },
    });
    hasSubmitted = !!existing;
  }

  socket.emit('session:state', {
    sessionId: session.id,
    roomCode: session.roomCode,
    quizTitle: session.quiz.title,
    status: session.status,
    totalQuestions: questions.length,
    currentQuestionIndex: session.currentQuestionIndex,
    participantCount: allParticipants.length,
    participantId: participant?.id || null,
    participants: allParticipants.map((p) => ({
      id: p.id, displayName: p.displayName, totalScore: p.totalScore, joinedAt: p.joinedAt.toISOString(),
    })),
    currentQuestion: questionPayload,
    hasSubmitted,
  });
}

async function getLeaderboard(sessionId: string) {
  // Get all participants EXCEPT organizers (those whose user has ORGANIZER role)
  const participants = await prisma.sessionParticipant.findMany({
    where: { sessionId },
    include: { user: true },
    orderBy: [{ totalScore: 'desc' }, { joinedAt: 'asc' }],
  });

  // Filter out organizers
  const players = participants.filter((p) => p.user.role !== 'ORGANIZER');

  let rank = 0;
  let prevScore = -1;
  return players.map((p) => {
    if (p.totalScore !== prevScore) {
      rank = rank + 1;
      prevScore = p.totalScore;
    }
    return {
      rank,
      displayName: p.displayName,
      totalScore: p.totalScore,
      correctCount: 0,
      userId: p.userId,
      isCurrentUser: false,
    };
  });
}

// ========== Question lifecycle ==========

async function openQuestion(sessionId: string) {
  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    include: { quiz: { include: { questions: { orderBy: { position: 'asc' } } } } },
  });

  if (!session) return;

  const question = session.quiz.questions[session.currentQuestionIndex];
  if (!question) return;

  // Use session override if set, otherwise question override, otherwise quiz default
  const timeLimit = session.timeLimit ?? question.timeLimit ?? session.quiz.defaultTimeLimit ?? 30;
  const points = session.points ?? question.points ?? session.quiz.defaultPoints ?? 100;
  const now = Date.now();
  const deadlineAt = now + timeLimit * 1000;

  const timerId = setTimeout(() => closeQuestion(sessionId), timeLimit * 1000);
  liveSessions.set(sessionId, {
    questionId: question.id,
    openedAt: now,
    deadlineAt,
    timerId,
  });

  await prisma.quizSession.update({
    where: { id: sessionId },
    data: { status: 'QUESTION_OPEN' },
  });

  const questionPayload = {
    questionId: question.id,
    questionNumber: session.currentQuestionIndex + 1,
    totalQuestions: session.quiz.questions.length,
    text: question.text,
    imageUrl: question.imageUrl,
    type: question.type as 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE',
    options: (await prisma.answerOption.findMany({
      where: { questionId: question.id },
      orderBy: { position: 'asc' },
    })).map((o) => ({
      id: o.id,
      text: o.text,
      imageUrl: o.imageUrl,
      position: o.position,
    })),
    deadlineAt,
    points,
  };

  io.to(`session:${sessionId}`).emit('question:open', questionPayload);
}

async function closeQuestion(sessionId: string) {
  const liveState = liveSessions.get(sessionId);
  if (!liveState) return;
  if (liveState.timerId) clearTimeout(liveState.timerId);

  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    include: { quiz: { include: { questions: true } } },
  });
  if (!session) return;

  await prisma.quizSession.update({
    where: { id: sessionId },
    data: { status: 'QUESTION_CLOSED' },
  });

  const question = await prisma.question.findUnique({
    where: { id: liveState.questionId },
    include: { options: true },
  });
  if (!question) return;

  const correctOptionIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);
  const leaderboard = await getLeaderboard(sessionId);

  // Broadcast general question-closed info to room
  io.to(`session:${sessionId}`).emit('question:closed', {
    questionId: question.id,
    correctOptionIds,
    explanation: null,
    leaderboard,
  });

  // Send per-participant result to each participant's socket
  const sockets = await io.in(`session:${sessionId}`).fetchSockets();
  for (const s of sockets) {
    const pId = (s as any).participantId;
    if (!pId) continue;
    const response = await prisma.response.findFirst({
      where: { participantId: pId, questionId: question.id },
      include: { selectedOptions: true },
    });
    s.emit('question:result', {
      questionId: question.id,
      isCorrect: response?.isCorrect || false,
      awardedPoints: response?.awardedPoints || 0,
      selectedOptionIds: response?.selectedOptions.map((so: any) => so.answerOptionId) || [],
      correctOptionIds,
      correctOptions: question.options.filter((o: any) => o.isCorrect).map((o: any) => ({ id: o.id, text: o.text })),
      allOptions: question.options.map((o: any) => ({ id: o.id, text: o.text })),
    });
  }

  io.to(`session:${sessionId}`).emit('leaderboard:update', leaderboard);
  liveSessions.delete(sessionId);

  // Auto-advance if enabled
  if (session.autoAdvance) {
    const delay = (session.autoAdvanceDelay || 5) * 1000;
    const totalQuestions = session.quiz.questions.length;
    const isLastQuestion = session.currentQuestionIndex + 1 >= totalQuestions;
    console.log(`[AUTO] Auto-advancing in ${delay / 1000}s for session ${sessionId} (last: ${isLastQuestion})`);

    const existing = autoAdvanceTimers.get(sessionId);
    if (existing) clearTimeout(existing);

    // Broadcast countdown with appropriate message
    io.to(`session:${sessionId}`).emit('countdown', {
      seconds: session.autoAdvanceDelay || 5,
      isLastQuestion,
    });

    const timer = setTimeout(async () => {
      autoAdvanceTimers.delete(sessionId);
      const currentSession = await prisma.quizSession.findUnique({
        where: { id: sessionId },
        include: { quiz: { include: { questions: { orderBy: { position: 'asc' } } } } },
      });
      if (!currentSession || currentSession.status !== 'QUESTION_CLOSED') return;

      const nextIndex = currentSession.currentQuestionIndex + 1;
      if (nextIndex >= currentSession.quiz.questions.length) {
        await finishSession(sessionId);
      } else {
        await prisma.quizSession.update({
          where: { id: sessionId },
          data: { currentQuestionIndex: nextIndex },
        });
        await openQuestion(sessionId);
      }
    }, delay);

    autoAdvanceTimers.set(sessionId, timer);
  }

  // Start lobby timeout between questions
  startLobbyTimeout(sessionId);
}

async function finishSession(sessionId: string) {
  const liveState = liveSessions.get(sessionId);
  if (liveState?.timerId) clearTimeout(liveState.timerId);
  liveSessions.delete(sessionId);
  clearLobbyTimeout(sessionId);
  const aaTimer = autoAdvanceTimers.get(sessionId);
  if (aaTimer) { clearTimeout(aaTimer); autoAdvanceTimers.delete(sessionId); }

  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    include: { quiz: true },
  });
  if (!session) return;

  await prisma.quizSession.update({
    where: { id: sessionId },
    data: { status: 'FINISHED', endedAt: new Date() },
  });

  const finalLeaderboard = await getLeaderboard(sessionId);
  const winner = finalLeaderboard[0];

  io.to(`session:${sessionId}`).emit('session:finished', {
    sessionId,
    finalLeaderboard,
    quizTitle: session.quiz.title,
    participantCount: finalLeaderboard.length,
    winnerName: winner?.displayName || 'N/A',
    winnerScore: winner?.totalScore || 0,
  });
}

// ========== Start server ==========

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Realtime server running on port ${PORT}`);
});
