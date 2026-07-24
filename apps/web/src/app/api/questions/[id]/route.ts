import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { updateQuestionSchema } from '@/lib/validators';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user || user.role !== 'ORGANIZER') {
      return NextResponse.json({ error: 'Organizer access required' }, { status: 403 });
    }

    const question = await prisma.question.findUnique({
      where: { id: params.id },
      include: { quiz: true },
    });

    if (!question || question.quiz.organizerId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { options, ...questionData } = parsed.data;

    const updated = await prisma.question.update({
      where: { id: params.id },
      data: {
        ...questionData,
        ...(options
          ? {
              options: {
                deleteMany: {},
                create: options.map((o) => ({
                  text: o.text,
                  imageUrl: o.imageUrl,
                  isCorrect: o.isCorrect,
                  position: o.position,
                })),
              },
            }
          : {}),
      },
      include: { options: { orderBy: { position: 'asc' } } },
    });

    return NextResponse.json({ data: updated });
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

    const question = await prisma.question.findUnique({
      where: { id: params.id },
      include: { quiz: true },
    });

    if (!question || question.quiz.organizerId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.question.delete({ where: { id: params.id } });
    return NextResponse.json({ data: { message: 'Deleted' } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
