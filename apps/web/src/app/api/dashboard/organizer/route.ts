import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireOrganizer } from '@/lib/auth';

export async function GET() {
  try {
    const user = await requireOrganizer();

    const quizzes = await prisma.quiz.findMany({
      where: { organizerId: user.id },
      include: {
        sessions: {
          include: {
            participants: { orderBy: { totalScore: 'desc' }, take: 1 },
            _count: { select: { participants: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const totalQuizzes = quizzes.length;
    const allSessions = quizzes.flatMap((q) => q.sessions)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const completedSessions = allSessions.filter((s) => s.status === 'FINISHED').length;

    // Total unique participants across all sessions
    const allSessionIds = allSessions.map((s) => s.id);
    const totalParticipants = allSessionIds.length > 0
      ? await prisma.sessionParticipant.count({ where: { sessionId: { in: allSessionIds } } })
      : 0;

    // Completion rate
    let completionRate = 0;
    if (totalParticipants > 0) {
      const finishedParticipants = await prisma.sessionParticipant.count({
        where: {
          sessionId: { in: allSessionIds },
          session: { status: 'FINISHED' },
        },
      });
      completionRate = Math.round((finishedParticipants / totalParticipants) * 100);
    }

    // Average participant score
    let avgPlayerScore = 0;
    if (allSessionIds.length > 0) {
      const allParticipants = await prisma.sessionParticipant.findMany({
        where: { sessionId: { in: allSessionIds } },
        select: { totalScore: true },
      });
      if (allParticipants.length > 0) {
        avgPlayerScore = Math.round(
          allParticipants.reduce((a, p) => a + p.totalScore, 0) / allParticipants.length
        );
      }
    }

    // Average correct percentage across all answers
    let avgCorrectPct = 0;
    if (allSessionIds.length > 0) {
      const totalResponses = await prisma.response.count({
        where: { sessionId: { in: allSessionIds } },
      });
      const correctResponses = await prisma.response.count({
        where: { sessionId: { in: allSessionIds }, isCorrect: true },
      });
      avgCorrectPct = totalResponses > 0 ? Math.round((correctResponses / totalResponses) * 100) : 0;
    }

    const recentSessions = allSessions.slice(0, 20).map((s) => ({
      id: s.id,
      quizTitle: quizzes.find((q) => q.id === s.quizId)?.title || 'Unknown',
      roomCode: s.roomCode,
      status: s.status,
      participantCount: (s as any)._count?.participants || 0,
      winnerName: s.participants[0]?.displayName || null,
      createdAt: s.createdAt.toISOString(),
    }));

    return NextResponse.json({
      data: {
        totalQuizzes,
        completedSessions,
        totalParticipants,
        completionRate,
        avgPlayerScore,
        avgCorrectPct,
        recentSessions,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
