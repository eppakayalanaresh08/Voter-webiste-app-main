import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProfile } from '@/lib/auth';
import { parseBoothNumbers, replaceSubUserBoothAssignments } from '@/lib/team-assignments';

export const runtime = 'nodejs';

const TeamAssignmentSchema = z.object({
  phone: z.string().min(8),
  fullName: z.string().min(1),
  boothInput: z.string().min(1)
});

export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || profile.role !== 'ASPIRANT' || !profile.tenant_id) {
    return NextResponse.json({ error: 'Only aspirants can manage team assignments' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = TeamAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const result = await replaceSubUserBoothAssignments(profile, {
      phone: parsed.data.phone,
      fullName: parsed.data.fullName,
      boothNumbers: parseBoothNumbers(parsed.data.boothInput)
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save booth assignments';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
