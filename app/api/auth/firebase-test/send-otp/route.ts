import { NextResponse } from 'next/server';

function normalizePhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return `+${trimmed.slice(1).replace(/\D+/g, '')}`;
  const digits = trimmed.replace(/\D+/g, '');
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_FIREBASE_TEST_AUTH !== 'true') {
    return NextResponse.json({ error: 'Test phone auth is disabled in production.' }, { status: 403 });
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing Firebase API key.' }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { phone?: string } | null;
  const phone = normalizePhone(body?.phone ?? '');
  if (!phone) {
    return NextResponse.json({ error: 'Valid phone is required.' }, { status: 400 });
  }

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      phoneNumber: phone,
      recaptchaToken: 'test'
    })
  });

  const json = (await res.json().catch(() => null)) as
    | { sessionInfo?: string; error?: { message?: string } }
    | null;

  if (!res.ok || !json?.sessionInfo) {
    return NextResponse.json(
      { error: json?.error?.message ?? 'Unable to send test OTP.' },
      { status: 400 }
    );
  }

  return NextResponse.json({ sessionInfo: json.sessionInfo, phone });
}

