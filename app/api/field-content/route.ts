import { NextResponse } from 'next/server';
import { getProfile } from '@/lib/auth';
import { FIELD_TEMPLATE_TOKENS } from '@/lib/field-content-shared';
import { getTenantFieldContent } from '@/lib/field-content';

export const runtime = 'nodejs';

export async function GET() {
  const profile = await getProfile();
  if (!profile?.tenant_id || profile.role === 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const content = await getTenantFieldContent(profile.tenant_id);

  return NextResponse.json({
    canEdit: profile.role === 'ASPIRANT',
    banners: content.banners,
    templates: content.templates,
    tokens: FIELD_TEMPLATE_TOKENS
  });
}
