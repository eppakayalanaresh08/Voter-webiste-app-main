import { NextResponse } from 'next/server';
import { getProfile } from '@/lib/auth';
import { resolveFieldAccessScope } from '@/lib/field-access';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (profile.role === 'SUPER_ADMIN' || !profile.tenant_id) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 403 });
  }

  const supabase = await supabaseServer();

  const url = new URL(req.url);
  const cursor = Number(url.searchParams.get('cursor') ?? '0');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '2000'), 5000);

  const scope = await resolveFieldAccessScope(profile);
  const upload = scope?.upload ?? null;

  if (!upload) return NextResponse.json({ error: 'No upload assigned' }, { status: 404 });

  let request = supabase
    .from('voters')
    .select('id, ward_no, booth_no, serial_no, voter_name, voter_name_tamil, relation_name, relation_name_tamil, epic_id, sex, age, dob, house_no, booth_name, booth_address, mobile_no, caste, religion, aadhar_card_no, education, profession, local_issue, interested_party, notes, updated_at')
    .eq('tenant_id', profile.tenant_id)
    .eq('upload_id', upload.id);

  if (scope?.boothNos && scope.boothNos.length > 0) {
    request = request.in('booth_no', scope.boothNos);
  }

  const { data: voters, error } = await request.range(cursor, cursor + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const nextCursor = (voters?.length ?? 0) < limit ? null : cursor + limit;

  return NextResponse.json({
    uploadId: upload.id,
    cursor,
    nextCursor,
    voters: voters ?? []
  });
}
