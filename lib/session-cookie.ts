import crypto from 'crypto';

export const SESSION_COOKIE_NAME = 'voter_session';

type SessionPayload = {
  phone: string;
  iat: number;
  exp: number;
};

function getSecret() {
  const secret = process.env.APP_SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || secret.length < 32) {
    throw new Error('Set APP_SESSION_SECRET (recommended) or SUPABASE_SERVICE_ROLE_KEY');
  }
  return secret;
}

function b64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function b64urlJson(value: unknown) {
  return b64url(Buffer.from(JSON.stringify(value), 'utf8'));
}

function parseB64urlJson<T>(value: string): T | null {
  try {
    const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + pad;
    return JSON.parse(Buffer.from(base64, 'base64').toString('utf8')) as T;
  } catch {
    return null;
  }
}

function sign(input: string) {
  return b64url(crypto.createHmac('sha256', getSecret()).update(input).digest());
}

export function createSessionToken(phone: string, maxAgeSeconds = 60 * 60 * 24 * 7) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    phone,
    iat: now,
    exp: now + maxAgeSeconds
  };

  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const body = b64urlJson(payload);
  const unsigned = `${header}.${body}`;
  const sig = sign(unsigned);
  return `${unsigned}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, sig] = parts;
  const unsigned = `${header}.${body}`;
  const expected = sign(unsigned);

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const payload = parseB64urlJson<SessionPayload>(body);
  if (!payload || !payload.phone || !payload.exp) return null;

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) return null;

  return payload;
}
