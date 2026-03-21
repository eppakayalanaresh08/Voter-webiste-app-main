import { NextResponse } from 'next/server';
import { getProfile } from '@/lib/auth';
import { getAspirantTeamPageData } from '@/lib/team-assignments';


export async function GET() {
  try {
    const profile = await getProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (profile.role !== 'ASPIRANT' || !profile.tenant_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await getAspirantTeamPageData(profile);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API Team Data] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
