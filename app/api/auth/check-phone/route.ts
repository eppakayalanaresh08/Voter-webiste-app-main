import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasAuthorizedPhone } from '@/lib/auth';

export const runtime = 'nodejs';

const CheckPhoneSchema = z.object({
  phone: z.string().min(8)
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = CheckPhoneSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const allowed = await hasAuthorizedPhone(parsed.data.phone);
  if (!allowed) {
    return NextResponse.json({
      allowed: false,
      message: 'This phone number is not invited yet. Ask an admin to add it first.'
    });
  }

  return NextResponse.json({ allowed: true });
}
