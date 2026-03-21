import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProfile } from '@/lib/auth';
import { getTenantFieldContent } from '@/lib/field-content';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const TemplateSchema = z.object({
  type: z.enum(['WHATSAPP']),
  name: z.string().min(1).max(120),
  body: z.string().min(1).max(5000),
  enabled: z.boolean().default(true),
  imagePath: z.string().max(500).nullable().optional()
});

export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile?.tenant_id || profile.role !== 'ASPIRANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = TemplateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const payload = {
    tenant_id: profile.tenant_id,
    type: parsed.data.type,
    name: parsed.data.name.trim(),
    body: parsed.data.body,
    enabled: parsed.data.enabled,
    image_url: parsed.data.imagePath ?? null,
    updated_at: new Date().toISOString()
  };

  const { data: existing } = await supabase
    .from('templates')
    .select('id')
    .eq('tenant_id', profile.tenant_id)
    .eq('type', parsed.data.type)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const result = existing?.id
    ? await supabase.from('templates').update(payload).eq('id', existing.id).eq('tenant_id', profile.tenant_id)
    : await supabase.from('templates').insert(payload);

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  const content = await getTenantFieldContent(profile.tenant_id);
  return NextResponse.json({ ok: true, templates: content.templates });
}
