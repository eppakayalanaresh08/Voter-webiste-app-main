import { NextResponse } from 'next/server';
import { getProfile } from '@/lib/auth';
import { listAssignedBooths, searchAssignedVoters } from '@/lib/assigned-voters';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!profile.tenant_id || profile.role === 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 403 });
  }

  const url = new URL(req.url);
  const mode = (url.searchParams.get('mode') ?? '').trim();

  if (mode === 'booths') {
    const { upload, booths } = await listAssignedBooths(profile);
    if (!upload) {
      return NextResponse.json({ error: 'No upload assigned' }, { status: 404 });
    }

    return NextResponse.json({ booths });
  }

  const filters = {
    q: (url.searchParams.get('q') ?? '').trim(),
    boothNo: (url.searchParams.get('boothNo') ?? '').trim(),
    voterName: (url.searchParams.get('voterName') ?? '').trim(),
    houseNo: (url.searchParams.get('houseNo') ?? '').trim(),
    epicId: (url.searchParams.get('epicId') ?? '').trim(),
    boothName: (url.searchParams.get('boothName') ?? '').trim(),
    phoneNumber: (url.searchParams.get('phoneNumber') ?? '').trim(),
    ageMin: url.searchParams.get('ageMin') ? parseInt(url.searchParams.get('ageMin')!, 10) : undefined,
    ageMax: url.searchParams.get('ageMax') ? parseInt(url.searchParams.get('ageMax')!, 10) : undefined,
  };

  const { upload, voters } = await searchAssignedVoters(profile, filters);
  if (!upload) {
    return NextResponse.json({ error: 'No upload assigned' }, { status: 404 });
  }

  return NextResponse.json({ voters });
}
