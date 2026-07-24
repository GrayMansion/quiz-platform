import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import prisma from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('JWT_SECRET env variable is required'); })() : 'dev-secret-change-me');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface JwtPayload {
  userId: string;
  role: string;
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
}

export async function getSession() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const payload = await verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, displayName: true, role: true, createdAt: true },
    });

    return user;
  } catch {
    return null;
  }
}

export async function requireAuth() {
  const user = await getSession();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function requireOrganizer() {
  const user = await requireAuth();
  if (user.role !== 'ORGANIZER') {
    throw new Error('Forbidden: organizer access required');
  }
  return user;
}
