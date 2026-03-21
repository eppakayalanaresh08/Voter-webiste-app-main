import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProfile } from '@/lib/auth';
import { resolveFieldAccessScope } from '@/lib/field-access';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const SyncSchema = z.object({
  uploadId: z.string().uuid(),
  edits: z.array(z.object({
    voterId: z.string().uuid(),
    patch: z.record(z.unknown()),
    baseUpdatedAt: z.string().optional()
  })).default([]),
  logs: z.array(z.object({
    voterId: z.string().uuid(),
    actionType: z.string(),
    payload: z.unknown().optional()
  })).default([])
});

type SyncResult = {
  editsApplied: number;
  logsInserted: number;
  conflicts: Array<{ voterId: string; serverUpdatedAt: string; clientBase: string }>;
};

export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!profile.tenant_id || profile.role === 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SyncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const scope = await resolveFieldAccessScope(profile);
  const upload = scope?.upload ?? null;

  if (!upload || upload.id !== parsed.data.uploadId) {
    return NextResponse.json({ error: 'Upload not assigned' }, { status: 403 });
  }

  const scopedBooths = scope?.boothNos?.length ? scope.boothNos : null;

  const results: SyncResult = { editsApplied: 0, logsInserted: 0, conflicts: [] };

  for (const e of parsed.data.edits) {
    const allowed: Record<string, unknown> = {};
    for (const k of ['mobile_no', 'notes', 'local_issue', 'interested_party', 'profession', 'education', 'caste', 'religion', 'aadhar_card_no']) {
      if (k in e.patch) allowed[k] = e.patch[k];
    }
    allowed.updated_at = new Date().toISOString();
    allowed.updated_by = profile.id;

    let currentRequest = supabase
      .from('voters')
      .select('id, updated_at, booth_no')
      .eq('id', e.voterId)
      .eq('tenant_id', profile.tenant_id)
      .eq('upload_id', upload.id);

    if (scopedBooths) {
      currentRequest = currentRequest.in('booth_no', scopedBooths);
    }

    const { data: current, error: currentError } = await currentRequest.single();

    if (currentError) {
      console.error(`[Sync] Error fetching current voter ${e.voterId}:`, currentError);
    }

    if (!current) continue;

    if (e.baseUpdatedAt && current.updated_at !== e.baseUpdatedAt) {
      results.conflicts.push({ voterId: e.voterId, serverUpdatedAt: current.updated_at, clientBase: e.baseUpdatedAt });
      continue;
    }

    let updateRequest = supabase
      .from('voters')
      .update(allowed)
      .eq('id', e.voterId)
      .eq('tenant_id', profile.tenant_id)
      .eq('upload_id', upload.id);

    if (scopedBooths) {
      updateRequest = updateRequest.in('booth_no', scopedBooths);
    }

    const { error } = await updateRequest;

    if (!error) results.editsApplied += 1;
  }

  if (parsed.data.logs.length) {
    const logVoterIds = Array.from(new Set(parsed.data.logs.map((log) => log.voterId)));
    let allowedVotersRequest = supabase
      .from('voters')
      .select('id')
      .eq('tenant_id', profile.tenant_id)
      .eq('upload_id', upload.id)
      .in('id', logVoterIds);

    if (scopedBooths) {
      allowedVotersRequest = allowedVotersRequest.in('booth_no', scopedBooths);
    }

    const { data: allowedVoters, error: allowedVotersError } = await allowedVotersRequest;
    if (allowedVotersError) {
      return NextResponse.json({ error: allowedVotersError.message }, { status: 500 });
    }

    const allowedVoterIds = new Set((allowedVoters ?? []).map((row) => row.id as string));
    const inserts = parsed.data.logs.map((l) => ({
      tenant_id: profile.tenant_id,
      upload_id: upload.id,
      voter_id: l.voterId,
      performed_by: profile.id,
      action_type: l.actionType,
      payload: l.payload ?? {}
    })).filter((row) => allowedVoterIds.has(row.voter_id));

    if (inserts.length > 0) {
      const { error } = await supabase.from('logs').insert(inserts);
      if (error) {
        console.error('[Sync] Error inserting logs into Supabase:', error);
        // We can also return the error to the client for better visibility
        return NextResponse.json({ error: `Supabase error: ${error.message}`, details: error }, { status: 500 });
      } else {
        results.logsInserted = inserts.length;
      }
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
