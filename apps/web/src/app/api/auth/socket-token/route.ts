import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Returns the JWT token from the HttpOnly cookie so the client
// can pass it to Socket.IO (which can't read HttpOnly cookies).
export async function GET() {
  const token = cookies().get('token')?.value;
  if (!token) {
    return NextResponse.json({ token: null });
  }
  return NextResponse.json({ token });
}
