const IDENTITY_TOOLKIT_BASE = 'https://identitytoolkit.googleapis.com/v1';

type VerifiedFirebaseUser = {
  uid: string;
  phoneNumber: string;
};

type TokenClaims = {
  aud?: string;
  iss?: string;
  exp?: number;
  sub?: string;
  phone_number?: string;
};

function parseTokenClaims(idToken: string): TokenClaims | null {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;

  try {
    const payload = parts[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    const json = Buffer.from(normalized + pad, 'base64').toString('utf8');
    return JSON.parse(json) as TokenClaims;
  } catch {
    return null;
  }
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) return null;

  const claims = parseTokenClaims(idToken);
  if (!claims) return null;

  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  const now = Math.floor(Date.now() / 1000);

  if (claims.aud !== projectId) return null;
  if (claims.iss !== expectedIssuer) return null;
  if (!claims.exp || claims.exp <= now) return null;

  const res = await fetch(`${IDENTITY_TOOLKIT_BASE}/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
    cache: 'no-store'
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    users?: Array<{ localId?: string; phoneNumber?: string }>;
  };

  const user = data.users?.[0];
  if (!user?.localId || !user.phoneNumber) return null;
  if (claims.sub && claims.sub !== user.localId) return null;

  return {
    uid: user.localId,
    phoneNumber: user.phoneNumber
  };
}
