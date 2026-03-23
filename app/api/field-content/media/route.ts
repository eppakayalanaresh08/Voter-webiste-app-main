import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProfile } from '@/lib/auth';
import { ensureFieldAssetBucket, getFieldAssetBucket } from '@/lib/field-content';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const MetaSchema = z.object({
  kind: z.enum(['banner', 'template']),
  templateType: z.enum(['WHATSAPP', 'THERMAL_PRINT']).nullable().optional(),
  existingPath: z.string().nullable().optional()
});

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
}

export async function POST(req: Request) {
  const profile = await getProfile();
  const tenantId = profile?.tenant_id;

  if (!tenantId || profile.role !== 'ASPIRANT') {
    return NextResponse.json({ error: 'Unauthorized. Only aspirant workspace owners can upload content.' }, { status: 401 });
  }

  const form = await req.formData();
  const parsed = MetaSchema.safeParse({
    kind: form.get('kind'),
    templateType: form.get('templateType'),
    existingPath: form.get('existingPath')
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid upload metadata', details: parsed.error.flatten() }, { status: 400 });
  }

  const { kind, templateType, existingPath } = parsed.data;

  if (kind === 'template' && !templateType) {
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
  
  // Use a stable path for templates to naturally overwrite (upsert)
  // For banners, we use a timestamp but we will delete the old one below
  const storagePath =
    kind === 'banner'
      ? `${tenantId}/banners/${Date.now()}-${sanitizeFileName(file.name || `asset${extension}`)}`
      : `${tenantId}/templates/${templateType?.toLowerCase() ?? 'asset'}/current`;
  
  const bytes = new Uint8Array(await file.arrayBuffer());

  // Delete existing file if provided to ensure singleton storage
  if (existingPath && existingPath !== storagePath && !/^(https?:)?\/\//i.test(existingPath) && !existingPath.startsWith('/')) {
    try {
      await admin.storage.from(bucket).remove([existingPath]);
    } catch (removeError) {
      console.error('[upload] Failed to remove old asset:', existingPath, removeError);
      // Continue upload even if cleanup fails
    }
  }

  const upload = await admin.storage.from(bucket).upload(storagePath, bytes, {
    contentType: file.type || 'image/png',
    upsert: true // Always upsert for safety
  });

  if (upload.error) {
    console.error('[media-upload] Supabase upload error:', upload.error);
    return NextResponse.json({ error: upload.error.message }, { status: 500 });
  }

  console.log('[media-upload] Successfully uploaded:', storagePath);

  const { data: signed, error: signedError } = await admin.storage.from(bucket).createSignedUrl(storagePath, 60 * 60 * 12);
  if (signedError) {
    console.error('[media-upload] Failed to generate initial signed URL:', signedError);
  }

  return NextResponse.json({
    ok: true,
    imagePath: storagePath,
    imageUrl: signedError ? null : signed.signedUrl
  });
}
