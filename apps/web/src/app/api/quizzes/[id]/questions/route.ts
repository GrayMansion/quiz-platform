import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { createQuestionSchema } from '@/lib/validators';

export async function POST(
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
    const parsed = createQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { options, ...questionData } = parsed.data;

    const question = await prisma.question.create({
      data: {
        ...questionData,
        quizId: params.id,
        options: {
          create: options.map((o) => ({
            text: o.text,
            imageUrl: o.imageUrl,
            isCorrect: o.isCorrect,
            position: o.position,
          })),
        },
      },
      include: { options: { orderBy: { position: 'asc' } } },
    });

    return NextResponse.json({
      data: {
        id: question.id,
        position: question.position,
        type: question.type,
        text: question.text,
        imageUrl: question.imageUrl,
        timeLimit: question.timeLimit,
        points: question.points,
        options: question.options.map((o) => ({
          id: o.id,
          text: o.text,
          imageUrl: o.imageUrl,
          isCorrect: o.isCorrect,
          position: o.position,
        })),
      },
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
