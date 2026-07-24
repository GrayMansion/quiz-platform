import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const roomCode = req.nextUrl.searchParams.get('roomCode');
    if (roomCode) {
      const session = await prisma.quizSession.findUnique({
        where: { roomCode: roomCode.toUpperCase() },
        select: { id: true, roomCode: true, status: true, quiz: { select: { title: true } } },
      });
      if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      if (session.status === 'FINISHED' || session.status === 'CANCELLED') {
        return NextResponse.json({ error: 'This session has ended' }, { status: 410 });
      }
      return NextResponse.json({
        data: { id: session.id, roomCode: session.roomCode, quizTitle: session.quiz.title, status: session.status },
      });
    }
    return NextResponse.json({ error: 'Provide roomCode query param' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
