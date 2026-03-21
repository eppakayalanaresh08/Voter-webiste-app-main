import { NextResponse } from 'next/server';
import { getProfile } from '@/lib/auth';
import { getCampaignOverview } from '@/lib/campaign-overview';
import { resolveFieldAccessScope } from '@/lib/field-access';
import { getTenantFieldContent } from '@/lib/field-content';


export async function GET() {
  try {
    const profile = await getProfile();
    if (!profile?.tenant_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [content, scope] = await Promise.all([
      getTenantFieldContent(profile.tenant_id, { enabledBannersOnly: true }),
      resolveFieldAccessScope(profile)
    ]);

    const overview = scope?.upload
      ? await getCampaignOverview({
          tenantId: profile.tenant_id,
          uploadId: scope.upload.id,
          boothNos: scope.boothNos
        })
      : null;

    return NextResponse.json({
      banners: content.banners,
      overview,
      scope
    });
  } catch (error) {
    console.error('[API Home Data] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
