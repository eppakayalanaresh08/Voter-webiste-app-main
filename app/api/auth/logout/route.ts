import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie';

export const runtime = 'nodejs';

function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });
  return response;
}

export async function POST() {
  return clearSessionCookie(NextResponse.json({ ok: true }));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const redirectTo = url.searchParams.get('redirect') || '/onboarding';
  return clearSessionCookie(NextResponse.redirect(new URL(redirectTo, url.origin)));
}
