import { cookies } from 'next/headers';
import { supabaseServer } from './supabase-server';
import { SESSION_COOKIE_NAME, verifySessionToken } from './session-cookie';

export type AppRole = 'SUPER_ADMIN' | 'ASPIRANT' | 'SUB_USER';

export type AppProfile = {
  id: string;
  role: AppRole;
  tenant_id: string | null;
  full_name: string | null;
  phone: string | null;
};

type PhoneInvite = {
  id: string;
  tenant_id: string | null;
  role: AppRole;
  full_name: string | null;
  phone: string;
};

type BootstrapCounts = {
  profileCount: number;
  inviteCount: number;
};

type ProfileUpsertInput = {
  id: string;
  tenantId: string | null;
  role: AppRole;
  fullName?: string | null;
  phone: string;
};

function isDuplicateUserError(message: string) {
  const msg = message.toLowerCase();
  return msg.includes('already') || msg.includes('duplicate');
}

function phoneCandidates(phone: string) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D+/g, '');
  const list = [trimmed, digits, `+${digits}`];

  if (digits.startsWith('91') && digits.length > 10) {
    list.push(digits.slice(2), `+${digits.slice(2)}`);
  }

  return Array.from(new Set(list.filter(Boolean)));
}

async function getBootstrapCounts() {
  const supabase = await supabaseServer();

  const [{ count: profileCount }, { count: inviteCount }] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('phone_invites').select('id', { count: 'exact', head: true })
  ]);

  return {
    profileCount: profileCount ?? 0,
    inviteCount: inviteCount ?? 0
  } satisfies BootstrapCounts;
}

async function isWorkspaceBootstrapEligible() {
  const counts = await getBootstrapCounts();
  return counts.profileCount === 0 && counts.inviteCount === 0;
}

async function resolveAuthUserIdByPhone(phone: string, preferredUserId?: string | null) {
  if (preferredUserId) return preferredUserId;

  const supabase = await supabaseServer();
  const candidates = new Set(phoneCandidates(phone));
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw new Error(error.message);
    }

    const matched = data.users.find((user) => user.phone && candidates.has(user.phone));
    if (matched?.id) return matched.id;
    if (!data.nextPage) return null;

    page = data.nextPage;
  }
}

async function upsertProfileRecord(input: ProfileUpsertInput) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: input.id,
      tenant_id: input.tenantId,
      role: input.role,
      full_name: input.fullName ?? null,
      phone: input.phone
    })
    .select('id, role, tenant_id, full_name, phone')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return (data as AppProfile | null) ?? null;
}

async function backfillSubUserAssignments(profile: AppProfile | null) {
  if (!profile?.tenant_id || profile.role !== 'SUB_USER' || !profile.phone) return profile;

  const supabase = await supabaseServer();

  // 1. Check if we already have an assignment for this profile
  const { data: existing } = await supabase
    .from('booth_assignments')
    .select('id')
    .eq('tenant_id', profile.tenant_id)
    .eq('sub_user_id', profile.id)
    .limit(1)
    .maybeSingle();

  if (existing) return profile;

  // 2. Otherwise, attempt to link by phone
  const now = new Date().toISOString();
  await supabase
    .from('booth_assignments')
    .update({
      sub_user_id: profile.id,
      assigned_name: profile.full_name ?? null,
      updated_at: now
    })
    .eq('tenant_id', profile.tenant_id)
    .in('assigned_phone', phoneCandidates(profile.phone))
    .is('sub_user_id', null); // Only update if not already linked

  return profile;
}

async function getOrCreateBootstrapTenantId() {
  const supabase = await supabaseServer();

  const { data: existing, error: existingError } = await supabase
    .from('tenants')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.id) return existing.id as string;

  const { data: created, error: createError } = await supabase
    .from('tenants')
    .insert({ name: 'Primary Workspace' })
    .select('id')
    .single();

  if (createError || !created?.id) {
    throw new Error(createError?.message ?? 'Failed to create initial workspace');
  }

  return created.id as string;
}

async function getInviteByPhone(phone: string) {
  const supabase = await supabaseServer();
  const candidates = phoneCandidates(phone);

  const { data: invite } = await supabase
    .from('phone_invites')
    .select('id, tenant_id, role, full_name, phone')
    .in('phone', candidates)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (invite as PhoneInvite | null) ?? null;
}

async function getProfileByPhone(phone: string) {
  const supabase = await supabaseServer();
  const candidates = phoneCandidates(phone);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, tenant_id, full_name, phone')
    .in('phone', candidates)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (profile as AppProfile | null) ?? null;
}

export async function hasAuthorizedPhone(phone: string) {
  const [existing, invite] = await Promise.all([getProfileByPhone(phone), getInviteByPhone(phone)]);
  if (existing || invite) return true;
  return isWorkspaceBootstrapEligible();
}

async function alignProfileWithInvite(profile: AppProfile, invite: PhoneInvite) {
  const needsUpdate =
    profile.role !== invite.role ||
    profile.tenant_id !== invite.tenant_id ||
    profile.full_name !== invite.full_name ||
    profile.phone !== invite.phone;

  if (!needsUpdate) return backfillSubUserAssignments(profile);

  const supabase = await supabaseServer();
  const { data: updated } = await supabase
    .from('profiles')
    .update({
      tenant_id: invite.tenant_id,
      role: invite.role,
      full_name: invite.full_name,
      phone: invite.phone
    })
    .eq('id', profile.id)
    .select('id, role, tenant_id, full_name, phone')
    .single();

  return backfillSubUserAssignments((updated as AppProfile | null) ?? profile);
}

async function bootstrapWorkspaceForPhone(phone: string) {
  if (!(await isWorkspaceBootstrapEligible())) return null;

  const supabase = await supabaseServer();

  console.log(`[bootstrap] Starting for ${phone}...`);
  try {
    console.time('[bootstrap] auth.admin.createUser');
    const { data: createdUser, error: createErr } = await supabase.auth.admin.createUser({
      phone,
      phone_confirm: true
    });
    console.timeEnd('[bootstrap] auth.admin.createUser');

    if (createErr && !isDuplicateUserError(createErr.message)) {
      throw new Error(`Auth Error: ${createErr.message}`);
    }

    console.time('[bootstrap] resolveAuthUserIdByPhone');
    const profileId = await resolveAuthUserIdByPhone(phone, createdUser?.user?.id ?? null);
    console.timeEnd('[bootstrap] resolveAuthUserIdByPhone');

    console.time('[bootstrap] getOrCreateBootstrapTenantId');
    const tenantId = await getOrCreateBootstrapTenantId();
    console.timeEnd('[bootstrap] getOrCreateBootstrapTenantId');

    if (!profileId) {
      throw new Error('Failed to resolve initial admin auth user');
    }

    console.time('[bootstrap] upsertProfileRecord');
    const profile = await upsertProfileRecord({
      id: profileId,
      tenantId,
      role: 'SUPER_ADMIN',
      phone
    });
    console.timeEnd('[bootstrap] upsertProfileRecord');

    return backfillSubUserAssignments(profile);
  } catch (err: any) {
    console.error(`[bootstrap] Error for ${phone}:`, err);
    if (err.message?.includes('fetch failed') || err.name === 'ConnectTimeoutError') {
      throw new Error('Connection to Supabase timed out. Please check your internet connection or Supabase project status.');
    }
    throw err;
  }
}

export async function getSessionPhone() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifySessionToken(token);
  return payload?.phone ?? null;
}

export async function ensureProfileForPhone(phone: string) {
  const [existing, invite] = await Promise.all([getProfileByPhone(phone), getInviteByPhone(phone)]);

  if (existing && invite) {
    return alignProfileWithInvite(existing, invite);
  }

  if (existing) return existing;

  if (!invite) {
    return bootstrapWorkspaceForPhone(phone);
  }

  const supabase = await supabaseServer();
  const { data: createdUser, error: createErr } = await supabase.auth.admin.createUser({
    phone: invite.phone,
    phone_confirm: true
  });

  if (createErr && !isDuplicateUserError(createErr.message)) {
    throw new Error(createErr.message);
  }

  const created = await getProfileByPhone(invite.phone);

  if (created) return alignProfileWithInvite(created, invite);

  const profileId = await resolveAuthUserIdByPhone(invite.phone, createdUser.user?.id ?? null);
  if (!profileId) {
    throw new Error('Failed to resolve invited auth user');
  }

  const profile = await upsertProfileRecord({
    id: profileId,
    tenantId: invite.tenant_id,
    role: invite.role,
    fullName: invite.full_name,
    phone: invite.phone
  });

  return backfillSubUserAssignments(profile);
}

export async function getProfile() {
  const phone = await getSessionPhone();
  if (!phone) return null;
  return ensureProfileForPhone(phone);
}
