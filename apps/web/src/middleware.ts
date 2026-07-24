import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = [
  '/login', '/register',
  '/api/auth/login', '/api/auth/register',
];

const publicApiPaths = [
  '/api/quizzes',           // Public quiz listing
  '/api/sessions',          // Session lookup by room code
  '/api/auth/socket-token', // Socket.IO token (returns null if not logged in)
];

const guestPaths = [
  '/session/join',
  '/session/',          // /session/[id]/lobby, /session/[id]/play, /session/[id]/results
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow public API paths for GET requests (quiz listing, session lookup)
  if (request.method === 'GET' && publicApiPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow guest-accessible paths (participants without login)
  if (guestPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Landing page and home are public
  if (pathname === '/' || pathname === '/home') {
    return NextResponse.next();
  }

  // Allow static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.match(/\.(css|js|png|jpg|svg)$/)
  ) {
    return NextResponse.next();
  }

  // API routes: just check cookie exists, individual routes verify token
  if (pathname.startsWith('/api/')) {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Protected pages: redirect to login if no token cookie
  const token = request.cookies.get('token')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
