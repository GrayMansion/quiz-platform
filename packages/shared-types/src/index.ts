// ========== Enums ==========

export enum UserRole {
  PARTICIPANT = 'PARTICIPANT',
  ORGANIZER = 'ORGANIZER',
}

export enum QuestionType {
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
}

export enum QuizStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum SessionStatus {
  LOBBY = 'LOBBY',
  QUESTION_OPEN = 'QUESTION_OPEN',
  QUESTION_CLOSED = 'QUESTION_CLOSED',
  FINISHED = 'FINISHED',
  CANCELLED = 'CANCELLED',
}

// ========== API Types ==========

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

export interface QuizSummary {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: QuizStatus;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuizDetail extends QuizSummary {
  rules: string | null;
  defaultTimeLimit: number;
  defaultPoints: number;
  questions: QuestionDetail[];
}

export interface QuestionDetail {
  id: string;
  position: number;
  type: QuestionType;
  text: string;
  imageUrl: string | null;
  timeLimit: number | null;
  points: number | null;
  options: AnswerOptionDetail[];
}

export interface AnswerOptionDetail {
  id: string;
  text: string;
  imageUrl: string | null;
  isCorrect: boolean;
  position: number;
}

export interface SessionSummary {
  id: string;
  quizTitle: string;
  roomCode: string;
  status: SessionStatus;
  participantCount: number;
  startedAt: string | null;
  endedAt: string | null;
}

export interface SessionDetail extends SessionSummary {
  quizId: string;
  currentQuestionIndex: number;
  participants: ParticipantSummary[];
}

export interface ParticipantSummary {
  id: string;
  displayName: string;
  totalScore: number;
  joinedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  totalScore: number;
  correctCount: number;
  userId: string;
  isCurrentUser: boolean;
}

export interface DashboardParticipant {
  sessionId: string;
  quizTitle: string;
  roomCode: string;
  rank: number;
  totalScore: number;
  correctCount: number;
  totalQuestions: number;
  completedAt: string | null;
}

export interface DashboardOrganizer {
  totalQuizzes: number;
  totalSessions: number;
  totalParticipants: number;
  averageScore: number;
  recentSessions: {
    id: string;
    quizTitle: string;
    roomCode: string;
    status: SessionStatus;
    participantCount: number;
    winnerName: string | null;
    createdAt: string;
  }[];
}

// ========== Socket.IO Event Types ==========

// Client -> Server
export interface ClientEvents {
  'session:join': (payload: { roomCode: string; displayName?: string }, callback: (res: { error?: string }) => void) => void;
  'session:start': (callback: (res: { error?: string }) => void) => void;
  'session:next': (callback: (res: { error?: string }) => void) => void;
  'answer:submit': (payload: { questionId: string; selectedOptionIds: string[] }, callback: (res: { error?: string }) => void) => void;
  'session:end': (callback: (res: { error?: string }) => void) => void;
}

// Server -> Client
export interface ServerEvents {
  'session:state': (payload: SessionStatePayload) => void;
  'question:open': (payload: QuestionOpenPayload) => void;
  'answer:accepted': (payload: { message: string }) => void;
  'question:closed': (payload: QuestionClosedPayload) => void;
  'leaderboard:update': (payload: LeaderboardEntry[]) => void;
  'session:finished': (payload: SessionFinishedPayload) => void;
  'session:error': (payload: { code: string; message: string }) => void;
  'participant:joined': (payload: { displayName: string; participantCount: number }) => void;
  'participant:left': (payload: { displayName: string; participantCount: number }) => void;
}

export interface SessionStatePayload {
  sessionId: string;
  roomCode: string;
  quizTitle: string;
  status: SessionStatus;
  totalQuestions: number;
  currentQuestionIndex: number;
  participantCount: number;
  participants: ParticipantSummary[];
  currentQuestion: QuestionOpenPayload | null;
  hasSubmitted: boolean;
}

export interface QuestionOpenPayload {
  questionId: string;
  questionNumber: number;
  totalQuestions: number;
  text: string;
  imageUrl: string | null;
  type: QuestionType;
  options: {
    id: string;
    text: string;
    imageUrl: string | null;
    position: number;
  }[];
  deadlineAt: number;
  points: number;
}

export interface QuestionClosedPayload {
  questionId: string;
  correctOptionIds: string[];
  explanation: string | null;
  personalResult: {
    isCorrect: boolean;
    awardedPoints: number;
    selectedOptionIds: string[];
  } | null;
  leaderboard: LeaderboardEntry[];
}

export interface SessionFinishedPayload {
  sessionId: string;
  finalLeaderboard: LeaderboardEntry[];
  quizTitle: string;
  participantCount: number;
  winnerName: string;
  winnerScore: number;
}

// ========== API Request/Response Types ==========

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateQuizRequest {
  title: string;
  description?: string;
  category?: string;
  defaultTimeLimit?: number;
  defaultPoints?: number;
  rules?: string;
}

export interface UpdateQuizRequest {
  title?: string;
  description?: string;
  category?: string;
  defaultTimeLimit?: number;
  defaultPoints?: number;
  rules?: string;
  status?: QuizStatus;
}

export interface CreateQuestionRequest {
  position: number;
  type: QuestionType;
  text: string;
  imageUrl?: string;
  timeLimit?: number;
  points?: number;
  options: {
    text: string;
    imageUrl?: string;
    isCorrect: boolean;
    position: number;
  }[];
}

export interface UpdateQuestionRequest {
  type?: QuestionType;
  text?: string;
  imageUrl?: string;
  timeLimit?: number;
  points?: number;
  options?: {
    text: string;
    imageUrl?: string;
    isCorrect: boolean;
    position: number;
  }[];
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
