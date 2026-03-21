import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { getProfile } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getMissingUploadHeaders, normalizeVoterUploadRow, type RowValue, type VoterUploadRow } from '@/lib/voter-upload-schema';

export const runtime = 'nodejs';

const FormSchema = z.object({
  aspirantInviteId: z.string().uuid(),
  location: z.string().min(1),
  uploaderName: z.string().min(1)
});

async function ensureBucket(admin: SupabaseClient, bucket: string) {
  const { data: buckets, error: listErr } = await admin.storage.listBuckets();
  if (listErr) {
    return `Unable to list buckets: ${listErr.message}`;
  }

  const exists = (buckets ?? []).some((b) => b.id === bucket || b.name === bucket);
  if (exists) return null;

  const { error: createErr } = await admin.storage.createBucket(bucket, {
    public: false
  });

  if (createErr && !createErr.message.toLowerCase().includes('already')) {
    return `Unable to create bucket "${bucket}": ${createErr.message}`;
  }

  return null;
}

export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || profile.role !== 'SUPER_ADMIN' || !profile.tenant_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await req.formData();
  const parsed = FormSchema.safeParse({
    aspirantInviteId: form.get('aspirantInviteId'),
    location: form.get('location'),
    uploaderName: form.get('uploaderName')
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid form fields', details: parsed.error.flatten() }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  const admin = await supabaseServer();

  const { data: invite } = await admin
    .from('phone_invites')
    .select('id, full_name, phone')
    .eq('id', parsed.data.aspirantInviteId)
    .eq('tenant_id', profile.tenant_id)
    .eq('role', 'ASPIRANT')
    .maybeSingle();

  if (!invite) {
    return NextResponse.json({ error: 'Invalid aspirant invite' }, { status: 400 });
  }

  const digits = (invite.phone ?? '').replace(/\D+/g, '');
  const phoneCandidates = Array.from(
    new Set(
      [invite.phone ?? '', digits, digits ? `+${digits}` : ''].filter(Boolean)
    )
  );

  let aspirantProfile: { id: string } | null = null;
  if (phoneCandidates.length > 0) {
    const { data } = await admin
      .from('profiles')
      .select('id')
      .in('phone', phoneCandidates)
      .eq('tenant_id', profile.tenant_id)
      .eq('role', 'ASPIRANT')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    aspirantProfile = data;
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'upload';
  const bucketErr = await ensureBucket(admin, bucket);
  if (bucketErr) {
    return NextResponse.json({ error: bucketErr }, { status: 500 });
  }

  const storagePath = `${profile.tenant_id}/${Date.now()}-${file.name}`;

  const arrayBuffer = await file.arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuffer);

  const up = await admin.storage.from(bucket).upload(storagePath, fileBytes, {
    contentType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    upsert: false
  });

  if (up.error) {
    return NextResponse.json({ error: `Storage upload failed: ${up.error.message}` }, { status: 500 });
  }

  const wb = XLSX.read(fileBytes, { type: 'array' });
  const firstSheet = wb.SheetNames[0];
  const ws = wb.Sheets[firstSheet];
  const headerRow = (XLSX.utils.sheet_to_json<RowValue[]>(ws, {
    header: 1,
    range: 0,
    blankrows: false
  })[0] ?? [])
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '');
  const missingHeaders = getMissingUploadHeaders(headerRow);
  if (missingHeaders.length) {
    return NextResponse.json({
      error: `Upload format mismatch. Missing headers: ${missingHeaders.join(', ')}`
    }, { status: 400 });
  }

  const rows = XLSX.utils.sheet_to_json<VoterUploadRow>(ws, { defval: null });

  const { data: uploadRow, error: uploadErr } = await admin
    .from('uploads')
    .insert({
      tenant_id: profile.tenant_id,
      uploaded_by: profile.id,
      uploader_name: parsed.data.uploaderName,
      aspirant_user_id: aspirantProfile?.id ?? null,
      aspirant_name: invite.full_name ?? invite.phone ?? 'Aspirant',
      location: parsed.data.location,
      original_filename: file.name,
      storage_path: storagePath,
      row_count: rows.length,
      status: 'IMPORTED'
    })
    .select('*')
    .single();

  if (uploadErr || !uploadRow) {
    return NextResponse.json({ error: `Upload metadata insert failed: ${uploadErr?.message}` }, { status: 500 });
  }

  const chunkSize = 1000;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize).map((row) => ({
      tenant_id: profile.tenant_id,
      upload_id: uploadRow.id,
      ...normalizeVoterUploadRow(row)
    }));

    const { error } = await admin.from('voters').insert(chunk);
    if (error) {
      return NextResponse.json({ error: `Voter insert failed at rows ${i}-${i + chunk.length}: ${error.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, uploadId: uploadRow.id, rows: rows.length });
}
