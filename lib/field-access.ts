import type { AppProfile, AppRole } from './auth';
import { supabaseServer } from './supabase-server';

export type FieldScopedUpload = {
  id: string;
  tenant_id: string | null;
  aspirant_user_id: string | null;
  aspirant_name: string | null;
  location: string | null;
  original_filename: string | null;
  row_count: number | null;
  status: string | null;
  created_at: string;
};

type BoothAssignmentRow = {
  id: string;
  upload_id: string;
  aspirant_user_id: string | null;
  sub_user_id: string | null;
  assigned_phone: string;
  booth_no: string | null;
  created_at: string;
};

export type FieldAccessScope = {
  role: AppRole;
  tenantId: string;
  upload: FieldScopedUpload | null;
  boothNos: string[] | null;
};

function phoneCandidates(phone: string | null | undefined) {
  const trimmed = (phone ?? '').trim();
  const digits = trimmed.replace(/\D+/g, '');
  const list = [trimmed, digits, digits ? `+${digits}` : ''];

  if (digits.startsWith('91') && digits.length > 10) {
    list.push(digits.slice(2), `+${digits.slice(2)}`);
  }

  return Array.from(new Set(list.filter(Boolean)));
}

function rankUpload(upload: FieldScopedUpload) {
  return upload.status === 'CONFIRMED' ? 1 : 0;
}

function compareUploads(left: FieldScopedUpload, right: FieldScopedUpload) {
  const rankDiff = rankUpload(right) - rankUpload(left);
  if (rankDiff !== 0) return rankDiff;
  return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
}

export async function findLatestAspirantUpload(tenantId: string, aspirantUserId: string) {
  const supabase = await supabaseServer();

  const run = async (status?: string) => {
    let query = supabase
      .from('uploads')
      .select('id, tenant_id, aspirant_user_id, aspirant_name, location, original_filename, row_count, status, created_at')
      .eq('tenant_id', tenantId)
      .eq('aspirant_user_id', aspirantUserId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (status) query = query.eq('status', status);

    const { data } = await query.maybeSingle();
    return (data as FieldScopedUpload | null) ?? null;
  };

  return (await run('CONFIRMED')) ?? (await run()) ?? null;
}

async function getSubUserAssignmentRows(profile: Pick<AppProfile, 'id' | 'tenant_id' | 'phone'>) {
  if (!profile.tenant_id) return [];

  const supabase = await supabaseServer();
  const phones = phoneCandidates(profile.phone);
  
  let query = supabase
    .from('booth_assignments')
    .select('id, upload_id, aspirant_user_id, sub_user_id, assigned_phone, booth_no, created_at')
    .eq('tenant_id', profile.tenant_id);

  if (phones.length > 0) {
    query = query.or(`sub_user_id.eq.${profile.id},assigned_phone.in.(${phones.map(p => `"${p}"`).join(',')})`);
  } else {
    query = query.eq('sub_user_id', profile.id);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[field-access] getSubUserAssignmentRows error:', error);
    return [];
  }

  return (data as BoothAssignmentRow[]) ?? [];
}

export async function resolveFieldAccessScope(
  profile: Pick<AppProfile, 'id' | 'role' | 'tenant_id' | 'phone'>
): Promise<FieldAccessScope | null> {
  if (!profile.tenant_id || profile.role === 'SUPER_ADMIN') {
    return null;
  }

  if (profile.role === 'ASPIRANT') {
    const upload = await findLatestAspirantUpload(profile.tenant_id, profile.id);
    return {
      role: profile.role,
      tenantId: profile.tenant_id,
      upload,
      boothNos: null
    };
  }

  const assignments = await getSubUserAssignmentRows(profile);
  if (!assignments.length) {
    return {
      role: profile.role,
      tenantId: profile.tenant_id,
      upload: null,
      boothNos: []
    };
  }

  const supabase = await supabaseServer();
  const uploadIds = Array.from(new Set(assignments.map((row) => row.upload_id)));
  const { data: uploadsRaw, error } = await supabase
    .from('uploads')
    .select('id, tenant_id, aspirant_user_id, aspirant_name, location, original_filename, row_count, status, created_at')
    .eq('tenant_id', profile.tenant_id)
    .in('id', uploadIds);

  if (error) {
    throw new Error(error.message);
  }

  const uploads = ((uploadsRaw ?? []) as FieldScopedUpload[]).sort(compareUploads);
  const upload = uploads[0] ?? null;

  if (!upload) {
    return {
      role: profile.role,
      tenantId: profile.tenant_id,
      upload: null,
      boothNos: []
    };
  }

  const boothNos = Array.from(
    new Set(
      assignments
        .filter((row) => row.upload_id === upload.id)
        .map((row) => row.booth_no?.trim() ?? '')
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }));

  return {
    role: profile.role,
    tenantId: profile.tenant_id,
    upload,
    boothNos
  };
}
