import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProfile } from '@/lib/auth';
import { resolveFieldAccessScope } from '@/lib/field-access';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const DirectLogSchema = z.object({
  voterId: z.string().uuid(),
  actionType: z.string(),
  payload: z.record(z.unknown()).optional()
});

export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!profile.tenant_id || profile.role === 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = DirectLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const scope = await resolveFieldAccessScope(profile);
  const upload = scope?.upload ?? null;

  if (!upload) {
    return NextResponse.json({ error: 'No active upload assigned' }, { status: 403 });
  }

  const supabase = await supabaseServer();

  // Verify voter belongs to this upload/tenant for security
  const { data: voter, error: voterErr } = await supabase
    .from('voters')
    .select('id')
    .eq('id', parsed.data.voterId)
    .eq('tenant_id', profile.tenant_id)
    .eq('upload_id', upload.id)
    .single();

  if (voterErr || !voter) {
    return NextResponse.json({ error: 'Voter not accessible in current scope' }, { status: 403 });
  }

  const { error } = await supabase.from('logs').insert({
    tenant_id: profile.tenant_id,
    upload_id: upload.id,
    voter_id: parsed.data.voterId,
    performed_by: profile.id,
    action_type: parsed.data.actionType,
    payload: parsed.data.payload ?? {}
  });

  if (error) {
    console.error('[LogsDirect] Error inserting log:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
