import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProfile } from '@/lib/auth';
import { getTenantFieldContent } from '@/lib/field-content';
import { getFieldAssetBucket } from '@/lib/field-content';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const TemplateSchema = z.object({
  type: z.enum(['WHATSAPP', 'THERMAL_PRINT']),
  name: z.string().min(1).max(120),
  body: z.string().min(1).max(5000),
  enabled: z.boolean().default(true),
  imagePath: z.string().max(500).nullable().optional()
});

function getTemplateTable(type: 'WHATSAPP' | 'THERMAL_PRINT') {
  return type === 'WHATSAPP' ? 'whatsapp_templates' : 'thermal_print_templates';
}

function isMissingRelation(message: string | undefined) {
  const lower = message?.toLowerCase() ?? '';
  return (
    (lower.includes('relation') && lower.includes('does not exist')) ||
    (lower.includes('could not find') && lower.includes('table')) ||
    (lower.includes('schema cache') && lower.includes('table'))
  );
}

function formatTemplateTableError(table: string, message: string | undefined) {
  if (isMissingRelation(message)) {
    return `Database table "${table}" is missing. Run FINAL_FIX_SCHEMA.sql in Supabase SQL Editor, then reload the app.`;
  }

  return message ?? `Database error while accessing "${table}".`;
}

async function detectTemplateStorage(profileTenantId: string, type: 'WHATSAPP' | 'THERMAL_PRINT') {
  const supabase = await supabaseServer();
  const splitTable = getTemplateTable(type);
  const probe = await supabase.from(splitTable).select('id').eq('tenant_id', profileTenantId).limit(1);

  if (!probe.error) {
    return { supabase, table: splitTable };
  }

  throw new Error(formatTemplateTableError(splitTable, probe.error.message));
}

export async function GET() {
  const profile = await getProfile();
  if (!profile?.tenant_id || profile.role !== 'ASPIRANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const content = await getTenantFieldContent(profile.tenant_id);
    return NextResponse.json({ ok: true, templates: content.templates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load templates' },
      { status: 500 }
    );
  }
}

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

  let storage: Awaited<ReturnType<typeof detectTemplateStorage>>;
  try {
    storage = await detectTemplateStorage(profile.tenant_id, parsed.data.type);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to access template storage' }, { status: 500 });
  }

  const { supabase, table } = storage;
  const payload = {
    tenant_id: profile.tenant_id,
    name: parsed.data.name.trim(),
    body: parsed.data.body,
    enabled: parsed.data.enabled,
    image_url: parsed.data.imagePath ?? null,
    updated_at: new Date().toISOString()
  };

  const existingQuery = await supabase
    .from(table)
    .select('id')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingQuery.error) {
    return NextResponse.json({ error: formatTemplateTableError(table, existingQuery.error.message) }, { status: 500 });
  }

  const result = existingQuery.data?.id
    ? await supabase.from(table).update(payload).eq('id', existingQuery.data.id).eq('tenant_id', profile.tenant_id)
    : await supabase.from(table).insert(payload);

  if (result.error) {
    return NextResponse.json({ error: formatTemplateTableError(table, result.error.message) }, { status: 500 });
  }

  try {
    const content = await getTenantFieldContent(profile.tenant_id);
    return NextResponse.json({ ok: true, templates: content.templates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to reload templates after save' },
      { status: 500 }
    );
  }
}

const TemplateDeleteSchema = z.object({
  type: z.enum(['WHATSAPP', 'THERMAL_PRINT'])
});

export async function DELETE(req: Request) {
  const profile = await getProfile();
  if (!profile?.tenant_id || profile.role !== 'ASPIRANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = TemplateDeleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  let storage: Awaited<ReturnType<typeof detectTemplateStorage>>;
  try {
    storage = await detectTemplateStorage(profile.tenant_id, parsed.data.type);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to access template storage' }, { status: 500 });
  }

  const { supabase, table } = storage;
  const existingResult = await supabase
    .from(table)
    .select('id, image_url')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingResult.error) {
    return NextResponse.json({ error: formatTemplateTableError(table, existingResult.error.message) }, { status: 500 });
  }
  const existing = existingResult.data;

  if (existing?.id) {
    const existingPath = (existing.image_url as string | null | undefined) ?? null;
    if (existingPath && !/^(https?:)?\/\//i.test(existingPath) && !existingPath.startsWith('/')) {
      await supabase.storage.from(getFieldAssetBucket()).remove([existingPath]);
    }

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('tenant_id', profile.tenant_id)
      .eq('id', existing.id);

    if (error) {
      return NextResponse.json({ error: formatTemplateTableError(table, error.message) }, { status: 500 });
    }
  }

  try {
    const content = await getTenantFieldContent(profile.tenant_id);
    return NextResponse.json({ ok: true, templates: content.templates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to reload templates after delete' },
      { status: 500 }
    );
  }
}
