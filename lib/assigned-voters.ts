import type { AppProfile } from './auth';
import { resolveFieldAccessScope } from './field-access';
import { supabaseServer } from './supabase-server';

export const ASSIGNED_VOTER_SELECT =
  'id, ward_no, booth_no, serial_no, voter_name, relation_name, epic_id, sex, age, dob, house_no, booth_name, booth_address, mobile_no, caste, religion, aadhar_card_no, education, profession, local_issue, interested_party, voter_name_tamil, relation_name_tamil, notes, updated_at';

export type AssignedVoterSearchFilters = {
  q?: string;
  boothNo?: string;
  voterName?: string;
  houseNo?: string;
  epicId?: string;
  boothName?: string;
  phoneNumber?: string;
  ageMin?: number;
  ageMax?: number;
};

type BoothOption = {
  boothNo: string | null;
  boothName: string | null;
};

function escapeSearchTerm(value: string) {
  return value.trim().replace(/[%_,]/g, ' ').replace(/\s+/g, ' ');
}

function normalizeFilterValue(value?: string) {
  return escapeSearchTerm(value ?? '');
}

export async function getAssignedUploadForProfile(profile: Pick<AppProfile, 'id' | 'tenant_id' | 'role' | 'phone'>) {
  const scope = await resolveFieldAccessScope(profile);
  if (!scope?.upload) {
    return null;
  }

  return {
    id: scope.upload.id,
    tenant_id: scope.upload.tenant_id,
    aspirant_user_id: scope.upload.aspirant_user_id,
    boothNos: scope.boothNos
  };
}

export async function searchAssignedVoters(
  profile: Pick<AppProfile, 'id' | 'tenant_id' | 'role' | 'phone'>,
  filters: AssignedVoterSearchFilters,
  limit = 50
) {
  const scope = await resolveFieldAccessScope(profile);
  if (!scope?.upload || !profile.tenant_id) {
    return { upload: null, voters: [] };
  }

  const supabase = await supabaseServer();
  let request = supabase
    .from('voters')
    .select(ASSIGNED_VOTER_SELECT)
    .eq('tenant_id', profile.tenant_id)
    .eq('upload_id', scope.upload.id)
    .limit(limit);

  if (scope.boothNos && scope.boothNos.length > 0) {
    request = request.in('booth_no', scope.boothNos);
  }

  const query = normalizeFilterValue(filters.q);
  const boothNo = normalizeFilterValue(filters.boothNo);
  const voterName = normalizeFilterValue(filters.voterName);
  const houseNo = normalizeFilterValue(filters.houseNo);
  const epicId = normalizeFilterValue(filters.epicId);
  const boothName = normalizeFilterValue(filters.boothName);
  const phoneNumber = normalizeFilterValue(filters.phoneNumber).replace(/\s+/g, '');

  if (query) {
    const pattern = `%${query}%`;
    request = request.or(
      [
        `voter_name.ilike.${pattern}`,
        `voter_name_tamil.ilike.${pattern}`,
        `relation_name.ilike.${pattern}`,
        `relation_name_tamil.ilike.${pattern}`,
        `epic_id.ilike.${pattern}`,
        `house_no.ilike.${pattern}`,
        `mobile_no.ilike.${pattern}`,
        `booth_no.ilike.${pattern}`,
        `booth_name.ilike.${pattern}`
      ].join(',')
    );
  }

  if (boothNo) request = request.ilike('booth_no', `%${boothNo}%`);
  if (voterName) {
    const pattern = `%${voterName}%`;
    request = request.or(
      [
        `voter_name.ilike.${pattern}`,
        `voter_name_tamil.ilike.${pattern}`
      ].join(',')
    );
  }
  if (houseNo) request = request.ilike('house_no', `%${houseNo}%`);
  if (epicId) request = request.ilike('epic_id', `%${epicId}%`);
  if (boothName) request = request.ilike('booth_name', `%${boothName}%`);
  if (phoneNumber) request = request.ilike('mobile_no', `%${phoneNumber}%`);
  if (filters.ageMin !== undefined && filters.ageMin !== null) request = request.gte('age', filters.ageMin);
  if (filters.ageMax !== undefined && filters.ageMax !== null) request = request.lte('age', filters.ageMax);

  const { data, error } = await request
    .order('booth_no', { ascending: true })
    .order('serial_no', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return {
    upload: {
      id: scope.upload.id,
      tenant_id: scope.upload.tenant_id,
      aspirant_user_id: scope.upload.aspirant_user_id
    },
    voters: (data ?? []) as Array<Record<string, unknown>>
  };
}

export async function listAssignedBooths(profile: Pick<AppProfile, 'id' | 'tenant_id' | 'role' | 'phone'>) {
  const scope = await resolveFieldAccessScope(profile);
  if (!scope?.upload || !profile.tenant_id) {
    return { upload: null, booths: [] as BoothOption[] };
  }

  const supabase = await supabaseServer();
  const booths = new Map<string, BoothOption>();
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    let request = supabase
      .from('voters')
      .select('booth_no, booth_name')
      .eq('tenant_id', profile.tenant_id)
      .eq('upload_id', scope.upload.id);

    if (scope.boothNos && scope.boothNos.length > 0) {
      request = request.in('booth_no', scope.boothNos);
    }

    const { data, error } = await request.range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<{ booth_no: string | null; booth_name: string | null }>;
    for (const row of rows) {
      const key = `${row.booth_no ?? ''}|${row.booth_name ?? ''}`;
      if (!booths.has(key)) {
        booths.set(key, {
          boothNo: row.booth_no,
          boothName: row.booth_name
        });
      }
    }

    if (rows.length < pageSize) break;
  }

  return {
    upload: {
      id: scope.upload.id,
      tenant_id: scope.upload.tenant_id,
      aspirant_user_id: scope.upload.aspirant_user_id
    },
    booths: [...booths.values()].sort((left, right) =>
      `${left.boothNo ?? ''} ${left.boothName ?? ''}`.localeCompare(`${right.boothNo ?? ''} ${right.boothName ?? ''}`, undefined, {
        numeric: true,
        sensitivity: 'base'
      })
    )
  };
}

export async function getAssignedVoterById(
  profile: Pick<AppProfile, 'id' | 'tenant_id' | 'role' | 'phone'>,
  voterId: string
) {
  const scope = await resolveFieldAccessScope(profile);
  if (!scope?.upload || !profile.tenant_id) {
    return { upload: null, voter: null, relatives: [] };
  }

  const supabase = await supabaseServer();
  let voterRequest = supabase
    .from('voters')
    .select(ASSIGNED_VOTER_SELECT)
    .eq('tenant_id', profile.tenant_id)
    .eq('upload_id', scope.upload.id)
    .eq('id', voterId);

  if (scope.boothNos && scope.boothNos.length > 0) {
    voterRequest = voterRequest.in('booth_no', scope.boothNos);
  }

  const { data: voter, error: voterError } = await voterRequest.maybeSingle();

  if (voterError) {
    throw new Error(voterError.message);
  }

  if (!voter) {
    return {
      upload: {
        id: scope.upload.id,
        tenant_id: scope.upload.tenant_id,
        aspirant_user_id: scope.upload.aspirant_user_id
      },
      voter: null,
      relatives: []
    };
  }

  let relatives: Array<Record<string, unknown>> = [];

  if (typeof voter.house_no === 'string' && voter.house_no.trim()) {
    let relativesRequest = supabase
      .from('voters')
      .select(ASSIGNED_VOTER_SELECT)
      .eq('tenant_id', profile.tenant_id)
      .eq('upload_id', scope.upload.id)
      .eq('house_no', voter.house_no)
      .neq('id', voterId);

    if (scope.boothNos && scope.boothNos.length > 0) {
      relativesRequest = relativesRequest.in('booth_no', scope.boothNos);
    }

    const { data: relativeRows, error: relativesError } = await relativesRequest.limit(50);

    if (relativesError) {
      throw new Error(relativesError.message);
    }

    relatives = (relativeRows ?? []) as Array<Record<string, unknown>>;
  }

  return {
    upload: {
      id: scope.upload.id,
      tenant_id: scope.upload.tenant_id,
      aspirant_user_id: scope.upload.aspirant_user_id
    },
    voter: voter as Record<string, unknown>,
    relatives
  };
}
