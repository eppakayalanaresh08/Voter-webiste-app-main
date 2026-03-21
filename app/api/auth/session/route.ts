import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureProfileForPhone } from '@/lib/auth';
import { verifyFirebaseIdToken } from '@/lib/firebase-token';
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/session-cookie';

export const runtime = 'nodejs';

const SessionSchema = z.object({
  idToken: z.string().min(32)
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = SessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const verified = await verifyFirebaseIdToken(parsed.data.idToken);
    if (!verified?.phoneNumber) {
      return NextResponse.json({ error: 'Invalid Firebase token' }, { status: 401 });
    }

    const profile = await ensureProfileForPhone(verified.phoneNumber);
    if (!profile) {
      return NextResponse.json({ error: 'Phone is not invited or profile is missing' }, { status: 403 });
    }

    const token = createSessionToken(verified.phoneNumber);
    const res = NextResponse.json({ ok: true, role: profile.role });

    res.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    });

    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected session initialization failure';
    console.error('Failed to create auth session', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
