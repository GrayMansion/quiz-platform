import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user || user.role !== 'ORGANIZER') {
      return NextResponse.json({ error: 'Organizer access required' }, { status: 403 });
    }

    const quiz = await prisma.quiz.findUnique({ where: { id: params.id } });
    if (!quiz || quiz.organizerId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (quiz.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Publish the quiz before starting a session' }, { status: 400 });
    }

    // Generate unique room code
    let roomCode: string;
    let attempts = 0;
    do {
      roomCode = generateRoomCode();
      const existing = await prisma.quizSession.findUnique({ where: { roomCode } });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    const body = await _req.json().catch(() => ({}));
    const useDefaults = body.useDefaults !== false;

    const session = await prisma.quizSession.create({
      data: {
        quizId: params.id,
        roomCode,
        status: 'LOBBY',
        timeLimit: useDefaults ? quiz.defaultTimeLimit : (body.timeLimit || quiz.defaultTimeLimit),
        points: useDefaults ? quiz.defaultPoints : (body.points || quiz.defaultPoints),
        autoAdvance: useDefaults ? false : (body.autoAdvance || false),
        autoAdvanceDelay: useDefaults ? 5 : (body.autoAdvanceDelay || 5),
      },
      include: {
        quiz: true,
      },
    });

    return NextResponse.json({
      data: {
        id: session.id,
        quizTitle: session.quiz.title,
        roomCode: session.roomCode,
        status: session.status,
        participantCount: 0,
        startedAt: null,
        endedAt: null,
        timeLimit: session.timeLimit,
        points: session.points,
        autoAdvance: session.autoAdvance,
        autoAdvanceDelay: session.autoAdvanceDelay,
      },
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
