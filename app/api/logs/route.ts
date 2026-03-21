import { NextResponse } from 'next/server';
import { getProfile } from '@/lib/auth';
import { resolveFieldAccessScope } from '@/lib/field-access';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date');

  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!profile.tenant_id || profile.role === 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 403 });
  }

  const scope = await resolveFieldAccessScope(profile);
  const upload = scope?.upload ?? null;

  if (!upload) {
    return NextResponse.json({ error: 'No active upload assigned' }, { status: 403 });
  }

  const supabase = await supabaseServer();

  // Fetch logs with voter names joined
  let query = supabase
    .from('logs')
    .select(`
      id,
      voter_id,
      action_type,
      payload,
      created_at,
      voters (
        voter_name,
        booth_no
      )
    `)
    .eq('tenant_id', profile.tenant_id)
    .eq('upload_id', upload.id);

  if (dateStr) {
    // Filter by the specific date (start of day to end of day)
    const start = `${dateStr}T00:00:00.000Z`;
    const end = `${dateStr}T23:59:59.999Z`;
    query = query.gte('created_at', start).lte('created_at', end);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[LogsFetch] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten the response to match what the UI expects
  const logs = (data as any[]).map(log => ({
    id: log.id,
    voterId: log.voter_id,
    actionType: log.action_type,
    payload: log.payload,
    createdAt: log.created_at,
    voterName: log.voters?.voter_name,
    boothInfo: log.voters?.booth_no ? `B-${log.voters.booth_no}` : ''
  }));

  return NextResponse.json({ logs });
}
