import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { updateQuizSchema } from '@/lib/validators';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const quiz = await prisma.quiz.findUnique({
      where: { id: params.id },
      include: {
        questions: {
          orderBy: { position: 'asc' },
          include: { options: { orderBy: { position: 'asc' } } },
        },
      },
    });

    if (!quiz) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Participants can only view published quizzes
    if (user.role !== 'ORGANIZER' && quiz.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        category: quiz.category,
        status: quiz.status,
        rules: quiz.rules,
        defaultTimeLimit: quiz.defaultTimeLimit,
        defaultPoints: quiz.defaultPoints,
        questionCount: quiz.questions.length,
        createdAt: quiz.createdAt.toISOString(),
        updatedAt: quiz.updatedAt.toISOString(),
        questions: quiz.questions.map((q) => ({
          id: q.id,
          position: q.position,
          type: q.type,
          text: q.text,
          imageUrl: q.imageUrl,
          timeLimit: q.timeLimit,
          points: q.points,
          options: q.options.map((o) => ({
            id: o.id,
            text: o.text,
            imageUrl: o.imageUrl,
            isCorrect: user.role === 'ORGANIZER' && quiz.organizerId === user.id ? o.isCorrect : false,
            position: o.position,
          })),
        })),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
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

    const body = await req.json();
    const parsed = updateQuizSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const updated = await prisma.quiz.update({
      where: { id: params.id },
      data: parsed.data,
    });

    return NextResponse.json({ data: { ...updated, updatedAt: updated.updatedAt.toISOString() } });
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
      return NextResponse.json({ error: 'Organizer access required' }, { status: 403 });
    }

    const quiz = await prisma.quiz.findUnique({ where: { id: params.id } });
    if (!quiz || quiz.organizerId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.quiz.delete({ where: { id: params.id } });
    return NextResponse.json({ data: { message: 'Deleted' } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
