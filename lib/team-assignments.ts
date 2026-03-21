import type { AppProfile } from './auth';
import { findLatestAspirantUpload, type FieldScopedUpload } from './field-access';
import { supabaseServer } from './supabase-server';

export type BoothOption = {
  boothNo: string;
  boothName: string | null;
};

export type TeamPerformance = {
  peopleReached: number;
  prints: number;
  messages: number;
  whatsapp: number;
  shares: number;
  lastActivity: string | null;
};

export type TeamAssignmentSummary = {
  phone: string;
  fullName: string | null;
  boothNos: string[];
  boothNames: string[];
  isActive: boolean;
  subUserId: string | null;
  performance: TeamPerformance;
};

type TeamInviteRow = {
  id: string;
  phone: string;
  full_name: string | null;
};

type TeamAssignmentRow = {
  assigned_phone: string;
  assigned_name: string | null;
  booth_no: string | null;
  booth_name: string | null;
  sub_user_id: string | null;
};

type TeamProfileRow = {
  id: string;
  phone: string | null;
  full_name: string | null;
};

type TeamLogRow = {
  performed_by: string | null;
  voter_id: string | null;
  action_type: string | null;
  created_at: string;
};

const PERFORMANCE_ACTIONS = ['PRINTED', 'MESSAGE_COPIED', 'WHATSAPP_OPENED', 'SHARED'] as const;

function emptyPerformance(): TeamPerformance {
  return {
    peopleReached: 0,
    prints: 0,
    messages: 0,
    whatsapp: 0,
    shares: 0,
    lastActivity: null
  };
}

function normalizePhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return `+${trimmed.slice(1).replace(/\D+/g, '')}`;

  const digits = trimmed.replace(/\D+/g, '');
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

function phoneCandidates(phone: string) {
  const normalized = normalizePhone(phone);
  const digits = normalized.replace(/\D+/g, '');
  const list = [normalized, digits, digits ? `+${digits}` : ''];

  if (digits.startsWith('91') && digits.length > 10) {
    list.push(digits.slice(2), `+${digits.slice(2)}`);
  }

  return Array.from(new Set(list.filter(Boolean)));
}

export function parseBoothNumbers(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }));
}

export async function listBoothsForUpload(tenantId: string, uploadId: string) {
  const supabase = await supabaseServer();
  const booths = new Map<string, BoothOption>();
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('voters')
      .select('booth_no, booth_name')
      .eq('tenant_id', tenantId)
      .eq('upload_id', uploadId)
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<{ booth_no: string | null; booth_name: string | null }>;
    for (const row of rows) {
      const boothNo = row.booth_no?.trim();
      if (!boothNo) continue;

      const key = boothNo;
      if (!booths.has(key)) {
        booths.set(key, {
          boothNo,
          boothName: row.booth_name
        });
      }
    }

    if (rows.length < pageSize) break;
  }

  return [...booths.values()].sort((left, right) =>
    left.boothNo.localeCompare(right.boothNo, undefined, { numeric: true, sensitivity: 'base' })
  );
}

export async function getAspirantTeamPageData(profile: Pick<AppProfile, 'id' | 'role' | 'tenant_id'>): Promise<{
  upload: FieldScopedUpload | null;
  boothOptions: BoothOption[];
  assignments: TeamAssignmentSummary[];
}> {
  if (profile.role !== 'ASPIRANT' || !profile.tenant_id) {
    return { upload: null, boothOptions: [], assignments: [] };
  }

  const upload = await findLatestAspirantUpload(profile.tenant_id, profile.id);
  if (!upload) {
    return { upload: null, boothOptions: [], assignments: [] };
  }

  const supabase = await supabaseServer();
  const boothOptions = await listBoothsForUpload(profile.tenant_id, upload.id);

  const [{ data: inviteRows }, { data: assignmentRows }] = await Promise.all([
    supabase
      .from('phone_invites')
      .select('id, phone, full_name')
      .eq('tenant_id', profile.tenant_id)
      .eq('role', 'SUB_USER')
      .eq('parent_user_id', profile.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('booth_assignments')
      .select('assigned_phone, assigned_name, booth_no, booth_name, sub_user_id')
      .eq('tenant_id', profile.tenant_id)
      .eq('upload_id', upload.id)
      .eq('aspirant_user_id', profile.id)
      .order('assigned_name', { ascending: true })
  ]);

  const phones = Array.from(
    new Set([
      ...((inviteRows ?? []) as TeamInviteRow[]).map((row) => row.phone),
      ...((assignmentRows ?? []) as TeamAssignmentRow[]).map((row) => row.assigned_phone)
    ].filter(Boolean))
  );

  let profileRows: TeamProfileRow[] = [];
  if (phones.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, phone, full_name')
      .eq('tenant_id', profile.tenant_id)
      .eq('role', 'SUB_USER')
      .in('phone', phones);

    profileRows = (data ?? []) as TeamProfileRow[];
  }

  const performanceByUserId = new Map<string, TeamPerformance>();
  const activeSubUserIds = profileRows.map((row) => row.id).filter(Boolean);
  if (activeSubUserIds.length > 0) {
    const pageSize = 1000;
    const reachedByUser = new Map<string, Set<string>>();

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('logs')
        .select('performed_by, voter_id, action_type, created_at')
        .eq('tenant_id', profile.tenant_id)
        .eq('upload_id', upload.id)
        .in('performed_by', activeSubUserIds)
        .in('action_type', [...PERFORMANCE_ACTIONS])
        .range(from, from + pageSize - 1);

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data ?? []) as TeamLogRow[];
      for (const row of rows) {
        if (!row.performed_by) continue;

        const current = performanceByUserId.get(row.performed_by) ?? emptyPerformance();
        if (row.action_type === 'PRINTED') current.prints += 1;
        if (row.action_type === 'MESSAGE_COPIED') current.messages += 1;
        if (row.action_type === 'WHATSAPP_OPENED') current.whatsapp += 1;
        if (row.action_type === 'SHARED') current.shares += 1;

        if (row.voter_id) {
          const reached = reachedByUser.get(row.performed_by) ?? new Set<string>();
          reached.add(row.voter_id);
          reachedByUser.set(row.performed_by, reached);
          current.peopleReached = reached.size;
        }

        if (!current.lastActivity || new Date(row.created_at).getTime() > new Date(current.lastActivity).getTime()) {
          current.lastActivity = row.created_at;
        }

        performanceByUserId.set(row.performed_by, current);
      }

      if (rows.length < pageSize) break;
    }
  }

  const profileByPhone = new Map(
    profileRows
      .filter((row) => row.phone)
      .map((row) => [row.phone as string, row])
  );
  const boothNameByNo = new Map(boothOptions.map((booth) => [booth.boothNo, booth.boothName]));
  const summaryByPhone = new Map<string, TeamAssignmentSummary>();

  for (const invite of (inviteRows ?? []) as TeamInviteRow[]) {
    const activeProfile = profileByPhone.get(invite.phone);
    summaryByPhone.set(invite.phone, {
      phone: invite.phone,
      fullName: activeProfile?.full_name ?? invite.full_name ?? null,
      boothNos: [],
      boothNames: [],
      isActive: Boolean(activeProfile),
      subUserId: activeProfile?.id ?? null,
      performance: activeProfile?.id ? performanceByUserId.get(activeProfile.id) ?? emptyPerformance() : emptyPerformance()
    });
  }

  for (const row of (assignmentRows ?? []) as TeamAssignmentRow[]) {
    const activeProfile = profileByPhone.get(row.assigned_phone);
    const current = summaryByPhone.get(row.assigned_phone) ?? {
      phone: row.assigned_phone,
      fullName: activeProfile?.full_name ?? row.assigned_name ?? null,
      boothNos: [],
      boothNames: [],
      isActive: Boolean(activeProfile || row.sub_user_id),
      subUserId: activeProfile?.id ?? row.sub_user_id,
      performance:
        (activeProfile?.id ? performanceByUserId.get(activeProfile.id) : row.sub_user_id ? performanceByUserId.get(row.sub_user_id) : null) ??
        emptyPerformance()
    };

    const boothNo = row.booth_no?.trim();
    if (boothNo && !current.boothNos.includes(boothNo)) {
      current.boothNos.push(boothNo);
      const boothName = row.booth_name ?? boothNameByNo.get(boothNo) ?? null;
      if (boothName && !current.boothNames.includes(boothName)) {
        current.boothNames.push(boothName);
      }
    }

    current.fullName = activeProfile?.full_name ?? current.fullName ?? row.assigned_name ?? null;
    current.isActive = Boolean(activeProfile || row.sub_user_id);
    current.subUserId = activeProfile?.id ?? row.sub_user_id ?? current.subUserId;
    current.performance =
      (activeProfile?.id ? performanceByUserId.get(activeProfile.id) : current.subUserId ? performanceByUserId.get(current.subUserId) : null) ??
      current.performance;
    summaryByPhone.set(row.assigned_phone, current);
  }

  const assignments = [...summaryByPhone.values()].sort((left, right) =>
    (left.fullName ?? left.phone).localeCompare(right.fullName ?? right.phone, undefined, {
      numeric: true,
      sensitivity: 'base'
    })
  );

  return {
    upload,
    boothOptions,
    assignments
  };
}

export async function replaceSubUserBoothAssignments(
  profile: Pick<AppProfile, 'id' | 'role' | 'tenant_id'>,
  input: {
    phone: string;
    fullName: string;
    boothNumbers: string[];
  }
) {
  if (profile.role !== 'ASPIRANT' || !profile.tenant_id) {
    throw new Error('Only aspirants can manage booth assignments');
  }

  const normalizedPhone = normalizePhone(input.phone);
  const fullName = input.fullName.trim();
  const boothNumbers = Array.from(new Set(input.boothNumbers.map((value) => value.trim()).filter(Boolean)));

  if (!normalizedPhone || normalizedPhone.length < 8) {
    throw new Error('Enter a valid phone number');
  }
  if (!fullName) {
    throw new Error('Enter name');
  }
  if (boothNumbers.length === 0) {
    throw new Error('Add at least one booth number');
  }

  const upload = await findLatestAspirantUpload(profile.tenant_id, profile.id);
  if (!upload) {
    throw new Error('No upload is assigned to this aspirant yet');
  }

  const supabase = await supabaseServer();
  const candidates = phoneCandidates(normalizedPhone);

  const { data: existingInvite } = await supabase
    .from('phone_invites')
    .select('id, role, parent_user_id')
    .eq('tenant_id', profile.tenant_id)
    .in('phone', candidates)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingInvite?.role && existingInvite.role !== 'SUB_USER') {
    throw new Error('This phone number already belongs to another role');
  }

  if (existingInvite?.parent_user_id && existingInvite.parent_user_id !== profile.id) {
    throw new Error('This sub user already belongs to another aspirant');
  }

  const { error: inviteError } = await supabase
    .from('phone_invites')
    .upsert(
      {
        tenant_id: profile.tenant_id,
        phone: normalizedPhone,
        role: 'SUB_USER',
        full_name: fullName,
        parent_user_id: profile.id
      },
      { onConflict: 'tenant_id,phone' }
    );

  if (inviteError) {
    throw new Error(inviteError.message);
  }

  const { data: subUserProfile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('tenant_id', profile.tenant_id)
    .in('phone', candidates)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subUserProfile?.role && subUserProfile.role !== 'SUB_USER') {
    throw new Error('This phone number already belongs to another role');
  }

  const { data: boothRows, error: boothError } = await supabase
    .from('voters')
    .select('booth_no, booth_name')
    .eq('tenant_id', profile.tenant_id)
    .eq('upload_id', upload.id)
    .in('booth_no', boothNumbers);

  if (boothError) {
    throw new Error(boothError.message);
  }

  const boothNameByNo = new Map<string, string | null>();
  for (const row of (boothRows ?? []) as Array<{ booth_no: string | null; booth_name: string | null }>) {
    const boothNo = row.booth_no?.trim();
    if (boothNo && !boothNameByNo.has(boothNo)) {
      boothNameByNo.set(boothNo, row.booth_name);
    }
  }

  const invalidBooths = boothNumbers.filter((boothNo) => !boothNameByNo.has(boothNo));
  if (invalidBooths.length > 0) {
    throw new Error(`Invalid booth number(s): ${invalidBooths.join(', ')}`);
  }

  const { error: deleteError } = await supabase
    .from('booth_assignments')
    .delete()
    .eq('tenant_id', profile.tenant_id)
    .eq('upload_id', upload.id)
    .eq('aspirant_user_id', profile.id)
    .eq('assigned_phone', normalizedPhone);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const now = new Date().toISOString();
  const rows = boothNumbers.map((boothNo) => ({
    tenant_id: profile.tenant_id,
    upload_id: upload.id,
    aspirant_user_id: profile.id,
    sub_user_id: subUserProfile?.role === 'SUB_USER' ? (subUserProfile.id as string) : null,
    assigned_phone: normalizedPhone,
    assigned_name: fullName,
    booth_no: boothNo,
    booth_name: boothNameByNo.get(boothNo) ?? null,
    updated_at: now
  }));

  const { error: insertError } = await supabase.from('booth_assignments').insert(rows);
  if (insertError) {
    throw new Error(insertError.message);
  }

  return {
    uploadId: upload.id,
    boothCount: boothNumbers.length
  };
}
