import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_FIREBASE_TEST_AUTH !== 'true') {
    return NextResponse.json({ error: 'Test phone auth is disabled in production.' }, { status: 403 });
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing Firebase API key.' }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as
    | { sessionInfo?: string; code?: string }
    | null;

  const sessionInfo = body?.sessionInfo?.trim() ?? '';
  const code = body?.code?.trim() ?? '';

  if (!sessionInfo || !code) {
    return NextResponse.json({ error: 'sessionInfo and code are required.' }, { status: 400 });
  }

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionInfo,
      code
    })
  });

  const json = (await res.json().catch(() => null)) as
    | { idToken?: string; error?: { message?: string } }
    | null;

  if (!res.ok || !json?.idToken) {
    return NextResponse.json(
      { error: json?.error?.message ?? 'OTP verification failed.' },
      { status: 400 }
    );
  }

  return NextResponse.json({ idToken: json.idToken });
}

