import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { createQuizSchema } from '@/lib/validators';

export async function GET() {
  try {
    const user = await getSession();

    if (user?.role === 'ORGANIZER') {
      // Organizers see their own quizzes (all statuses)
      const quizzes = await prisma.quiz.findMany({
        where: { organizerId: user.id },
        include: { _count: { select: { questions: true } } },
        orderBy: { updatedAt: 'desc' },
      });
      return NextResponse.json({
        data: quizzes.map((q) => ({
          id: q.id,
          title: q.title,
          description: q.description,
          category: q.category,
          status: q.status,
          questionCount: q._count.questions,
          createdAt: q.createdAt.toISOString(),
          updatedAt: q.updatedAt.toISOString(),
        })),
      });
    }

    // Everyone else (participants + guests) sees only published quizzes
    const quizzes = await prisma.quiz.findMany({
      where: { status: 'PUBLISHED' },
      include: { _count: { select: { questions: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({
      data: quizzes.map((q) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        category: q.category,
        status: q.status,
        questionCount: q._count.questions,
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.updatedAt.toISOString(),
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user || user.role !== 'ORGANIZER') {
      return NextResponse.json({ error: 'Organizer access required' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createQuizSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const quiz = await prisma.quiz.create({
      data: {
        ...parsed.data,
        organizerId: user.id,
      },
    });

    return NextResponse.json({
      data: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        category: quiz.category,
        status: quiz.status,
        questionCount: 0,
        rules: quiz.rules,
        defaultTimeLimit: quiz.defaultTimeLimit,
        defaultPoints: quiz.defaultPoints,
        createdAt: quiz.createdAt.toISOString(),
        updatedAt: quiz.updatedAt.toISOString(),
      },
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
