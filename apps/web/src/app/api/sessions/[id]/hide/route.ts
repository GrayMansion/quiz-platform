import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// POST: Participant hides a session from their own history by deleting their participant record
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const session = await prisma.quizSession.findUnique({
      where: { id: params.id },
    });

    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Find and delete this user's participant record
    const participant = await prisma.sessionParticipant.findFirst({
      where: { sessionId: params.id, userId: user.id },
    });

    if (!participant) {
      return NextResponse.json({ error: 'You are not a participant in this session' }, { status: 404 });
    }

    // Delete the participant record (cascades to responses)
    await prisma.sessionParticipant.delete({
      where: { id: participant.id },
    });

    return NextResponse.json({ data: { message: 'Session removed from your history' } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
