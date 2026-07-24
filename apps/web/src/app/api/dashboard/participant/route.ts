import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const participations = await prisma.sessionParticipant.findMany({
      where: { userId: user.id },
      include: {
        session: {
          include: { quiz: true },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const items = await Promise.all(
      participations.map(async (p) => {
        const correctCount = await prisma.response.count({
          where: { participantId: p.id, isCorrect: true },
        });
        const totalQuestions = await prisma.question.count({
          where: { quizId: p.session.quizId },
        });

        return {
          sessionId: p.sessionId,
          quizTitle: p.session.quiz.title,
          roomCode: p.session.roomCode,
          rank: 0,
          totalScore: p.totalScore,
          correctCount,
          totalQuestions,
          completedAt: p.session.endedAt?.toISOString() || null,
          maxPossibleScore: 0, // computed below
        };
      })
    );

    // Compute ranks per session
    for (const item of items) {
      const better = await prisma.sessionParticipant.count({
        where: { sessionId: item.sessionId, totalScore: { gt: item.totalScore } },
      });
      item.rank = better + 1;
    }

    // Compute aggregate stats
    const completed = items.filter((i) => i.completedAt);
    const quizzesCompleted = completed.length;

    let avgScore = 0;
    if (completed.length > 0) {
      avgScore = Math.round(
        completed.reduce((s, i) => s + i.totalScore, 0) / completed.length
      );
    }

    let correctAnswerRate = 0;
    const totalAnswered = items.reduce((s, i) => s + i.totalQuestions, 0);
    const totalCorrect = items.reduce((s, i) => s + i.correctCount, 0);
    if (totalAnswered > 0) {
      correctAnswerRate = Math.round((totalCorrect / totalAnswered) * 100);
    }

    const bestScore = completed.length > 0
      ? Math.max(...completed.map((i) => i.totalScore))
      : 0;

    let avgRank = 0;
    if (items.length > 0) {
      avgRank = parseFloat(
        (items.reduce((s, i) => s + i.rank, 0) / items.length).toFixed(1)
      );
    }

    const participantCount = await prisma.sessionParticipant.count();

    return NextResponse.json({
      data: {
        items,
        stats: {
          quizzesCompleted,
          avgScore,
          correctAnswerRate,
          bestScore,
          avgRank,
          totalParticipantCount: participantCount,
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
