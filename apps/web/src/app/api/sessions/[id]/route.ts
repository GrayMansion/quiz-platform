import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession().catch(() => null);

    const session = await prisma.quizSession.findUnique({
      where: { id: params.id },
      include: {
        quiz: true,
        participants: {
          orderBy: { totalScore: 'desc' },
        },
      },
    });

    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      data: {
        id: session.id,
        quizId: session.quizId,
        quizTitle: session.quiz.title,
        roomCode: session.roomCode,
        status: session.status,
        currentQuestionIndex: session.currentQuestionIndex,
        participantCount: session.participants.length,
        startedAt: session.startedAt?.toISOString() || null,
        endedAt: session.endedAt?.toISOString() || null,
        participants: session.participants.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          totalScore: p.totalScore,
          joinedAt: p.joinedAt.toISOString(),
        })),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user || user.role !== 'ORGANIZER') {
      return NextResponse.json({ error: 'Only organizers can delete sessions' }, { status: 403 });
    }

    const session = await prisma.quizSession.findUnique({
      where: { id: params.id },
      include: { quiz: true },
    });

    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.quiz.organizerId !== user.id) {
      return NextResponse.json({ error: 'You can only delete your own sessions' }, { status: 403 });
    }

    // Allow deletion of finished, cancelled, or lobby sessions (not active ones)
    if (session.status !== 'FINISHED' && session.status !== 'CANCELLED' && session.status !== 'LOBBY') {
      return NextResponse.json({
        error: 'Cannot delete an active session. End the quiz first.'
      }, { status: 400 });
    }

    await prisma.quizSession.delete({ where: { id: params.id } });

    return NextResponse.json({ data: { message: 'Session deleted' } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: Close (cancel) a session
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession().catch(() => null);
    if (!user || user.role !== 'ORGANIZER') {
      return NextResponse.json({ error: 'Only organizers can manage sessions' }, { status: 403 });
    }

    const session = await prisma.quizSession.findUnique({
      where: { id: params.id },
      include: { quiz: true },
    });

    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.quiz.organizerId !== user.id) {
      return NextResponse.json({ error: 'You can only manage your own sessions' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    if (body.status === 'CANCELLED') {
      if (session.status !== 'LOBBY') {
        return NextResponse.json({ error: 'Only lobby sessions can be cancelled this way' }, { status: 400 });
      }
      const updated = await prisma.quizSession.update({
        where: { id: params.id },
        data: { status: 'CANCELLED', endedAt: new Date() },
      });

      // Notify realtime server so connected participants see the cancellation immediately
      try {
        await fetch(`http://localhost:3001/internal/cancel-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: params.id }),
        });
      } catch { /* realtime server might be down — ignore */ }

      return NextResponse.json({ data: { id: updated.id, status: updated.status } });
    }

    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
