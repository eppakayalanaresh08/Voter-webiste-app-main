import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProfile } from '@/lib/auth';
import { ensureFieldAssetBucket, getFieldAssetBucket } from '@/lib/field-content';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const MetaSchema = z.object({
  kind: z.enum(['banner', 'template']),
  templateType: z.enum(['WHATSAPP', 'THERMAL_PRINT']).optional()
});

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
}

export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile?.tenant_id || profile.role !== 'ASPIRANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await req.formData();
  const parsed = MetaSchema.safeParse({
    kind: form.get('kind'),
    templateType: form.get('templateType')
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid upload metadata', details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.kind === 'template' && !parsed.data.templateType) {
    return NextResponse.json({ error: 'Template image uploads require a template type' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  await ensureFieldAssetBucket();

  const admin = await supabaseServer();
  const bucket = getFieldAssetBucket();
  const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '.png';
  const prefix = parsed.data.kind === 'banner' ? 'banners' : `templates/${parsed.data.templateType?.toLowerCase() ?? 'asset'}`;
  const storagePath = `${profile.tenant_id}/${prefix}/${Date.now()}-${sanitizeFileName(file.name || `asset${extension}`)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const upload = await admin.storage.from(bucket).upload(storagePath, bytes, {
    contentType: file.type || 'image/png',
    upsert: false
  });

  if (upload.error) {
    return NextResponse.json({ error: upload.error.message }, { status: 500 });
  }

  const { data: signed, error: signedError } = await admin.storage.from(bucket).createSignedUrl(storagePath, 60 * 60 * 12);

  return NextResponse.json({
    ok: true,
    imagePath: storagePath,
    imageUrl: signedError ? null : signed.signedUrl
  });
}
