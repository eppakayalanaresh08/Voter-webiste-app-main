import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProfile } from '@/lib/auth';
import { getTenantFieldContent } from '@/lib/field-content';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const BannerSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().max(120).default(''),
  subtitle: z.string().max(300).default(''),
  enabled: z.boolean().default(true),
  imagePath: z.string().max(500).nullable().optional()
});

export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile?.tenant_id || profile.role !== 'ASPIRANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BannerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await supabaseServer();

  const payload = {
    tenant_id: profile.tenant_id,
    title: parsed.data.title.trim() || null,
    subtitle: parsed.data.subtitle.trim() || null,
    enabled: parsed.data.enabled,
    image_url: parsed.data.imagePath ?? null
  };

  let error: string | null = null;

  if (parsed.data.id) {
    const { error: updateError } = await supabase
      .from('banners')
      .update(payload)
      .eq('id', parsed.data.id)
      .eq('tenant_id', profile.tenant_id);
    error = updateError?.message ?? null;
  } else {
    const { error: insertError } = await supabase.from('banners').insert(payload);
    error = insertError?.message ?? null;
  }

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const content = await getTenantFieldContent(profile.tenant_id);
  return NextResponse.json({ ok: true, banners: content.banners });
}

const BannerOrderSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int().nonnegative()
  })).min(1)
});

export async function PATCH(req: Request) {
  const profile = await getProfile();
  if (!profile?.tenant_id || profile.role !== 'ASPIRANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BannerOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json(
    { error: 'Manual banner ordering is not available with the current database schema.' },
    { status: 400 }
  );
}

const BannerDeleteSchema = z.object({
  id: z.string().uuid()
});

export async function DELETE(req: Request) {
  const profile = await getProfile();
  if (!profile?.tenant_id || profile.role !== 'ASPIRANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BannerDeleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from('banners')
    .delete()
    .eq('tenant_id', profile.tenant_id)
    .eq('id', parsed.data.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const content = await getTenantFieldContent(profile.tenant_id);
  return NextResponse.json({ ok: true, banners: content.banners });
}
