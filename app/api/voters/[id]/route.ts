import { NextResponse } from 'next/server';
import { getProfile } from '@/lib/auth';
import { getAssignedVoterById } from '@/lib/assigned-voters';

export const runtime = 'nodejs';


export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!profile.tenant_id || profile.role === 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 403 });
  }

  const { upload, voter, relatives } = await getAssignedVoterById(profile, params.id);
  if (!upload) {
    return NextResponse.json({ error: 'No upload assigned' }, { status: 404 });
  }

  if (!voter) {
    return NextResponse.json({ error: 'Voter not found' }, { status: 404 });
  }

  return NextResponse.json({ voter, relatives });
}
