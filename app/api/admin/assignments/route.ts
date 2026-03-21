import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProfile } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const AssignmentSchema = z.object({
  uploadId: z.string().uuid(),
  aspirantUserId: z.string().uuid(),
  action: z.enum(['SAVE', 'CONFIRM']).default('SAVE')
});

export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || profile.role !== 'SUPER_ADMIN' || !profile.tenant_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = AssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const supabase = await supabaseServer();

  const { data: aspirant } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', parsed.data.aspirantUserId)
    .eq('tenant_id', profile.tenant_id)
    .eq('role', 'ASPIRANT')
    .maybeSingle();

  if (!aspirant) {
    return NextResponse.json({ error: 'Invalid aspirant' }, { status: 400 });
  }

  const { error } = await supabase
    .from('uploads')
    .update({
      aspirant_user_id: aspirant.id,
      aspirant_name: aspirant.full_name ?? null,
      status: parsed.data.action === 'CONFIRM' ? 'CONFIRMED' : 'ASSIGNED'
    })
    .eq('id', parsed.data.uploadId)
    .eq('tenant_id', profile.tenant_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
