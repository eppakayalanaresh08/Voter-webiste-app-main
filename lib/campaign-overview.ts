import { supabaseServer } from './supabase-server';

const PAGE_SIZE = 1000;

type UploadRow = {
  id: string;
  original_filename: string | null;
  location: string | null;
  row_count: number | null;
  status: string | null;
  created_at: string;
  aspirant_name: string | null;
};

type RawVoter = {
  id: string;
  ward_no: string | null;
  booth_no: string | null;
  booth_name: string | null;
  sex: string | null;
  age: number | null;
  dob: string | null;
  mobile_no: string | null;
  caste: string | null;
  religion: string | null;
  aadhar_card_no: string | null;
  house_no: string | null;
  relation_name: string | null;
  voter_name: string | null;
  epic_id: string | null;
  local_issue: string | null;
  interested_party: string | null;
};

export type AgeBand = {
  label: string;
  count: number;
};

export type BoothSummary = {
  key: string;
  boothNo: string | null;
  boothName: string | null;
  voters: number;
  male: number;
  female: number;
  other: number;
  mobile: number;
  issues: number;
};

export type CampaignOverview = {
  upload: UploadRow;
  totals: {
    voters: number;
    wards: number;
    booths: number;
    households: number;
    male: number;
    female: number;
    other: number;
    mobile: number;
    mobilePct: number;
    caste: number;
    religion: number;
    aadhaar: number;
    dob: number;
    age: number;
    issues: number;
    interests: number;
    potentialDuplicates: number;
  };
  ageBands: AgeBand[];
  topBooths: BoothSummary[];
};

export type AdminOpsCounts = {
  uploads: number;
  confirmedUploads: number;
  invites: number;
  aspirants: number;
  subUsers: number;
};

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeSex(value: string | null | undefined) {
  const sex = normalizeText(value).toUpperCase();
  if (sex.startsWith('M')) return 'male';
  if (sex.startsWith('F')) return 'female';
  return 'other';
}

function roundPercent(count: number, total: number) {
  if (!total) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function getBoothKey(voter: Pick<RawVoter, 'booth_no' | 'booth_name'>) {
  const boothNo = normalizeText(voter.booth_no);
  const boothName = normalizeText(voter.booth_name);
  return boothNo || boothName ? `${boothNo}|${boothName}` : 'unknown';
}

async function findActiveUpload(tenantId: string, aspirantUserId?: string) {
  const supabase = await supabaseServer();

  const run = async (status?: string) => {
    let query = supabase
      .from('uploads')
      .select('id, original_filename, location, row_count, status, created_at, aspirant_name')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (aspirantUserId) query = query.eq('aspirant_user_id', aspirantUserId);
    if (status) query = query.eq('status', status);

    const { data } = await query.maybeSingle();
    return (data as UploadRow | null) ?? null;
  };

  return (await run('CONFIRMED')) ?? (await run()) ?? null;
}

async function fetchAllVoters(tenantId: string, uploadId: string, boothNos?: string[] | null) {
  const supabase = await supabaseServer();
  const voters: RawVoter[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    let request = supabase
      .from('voters')
      .select(
        'id, ward_no, booth_no, booth_name, sex, age, dob, mobile_no, caste, religion, aadhar_card_no, house_no, relation_name, voter_name, epic_id, local_issue, interested_party'
      )
      .eq('tenant_id', tenantId)
      .eq('upload_id', uploadId);

    if (boothNos && boothNos.length > 0) {
      request = request.in('booth_no', boothNos);
    }

    const { data, error } = await request.range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as RawVoter[];
    voters.push(...rows);

    if (rows.length < PAGE_SIZE) break;
  }

  return voters;
}

function summarizeOverview(upload: UploadRow, voters: RawVoter[]): CampaignOverview {
  const wards = new Set<string>();
  const households = new Set<string>();
  const ageBands: AgeBand[] = [
    { label: '18-24', count: 0 },
    { label: '25-34', count: 0 },
    { label: '35-44', count: 0 },
    { label: '45-59', count: 0 },
    { label: '60-74', count: 0 },
    { label: '75+', count: 0 }
  ];
  const boothMap = new Map<string, BoothSummary>();
  const epicMap = new Map<string, string[]>();
  const householdDuplicateMap = new Map<string, string[]>();

  let male = 0;
  let female = 0;
  let other = 0;
  let mobile = 0;
  let caste = 0;
  let religion = 0;
  let aadhaar = 0;
  let dob = 0;
  let age = 0;
  let issues = 0;
  let interests = 0;

  for (const voter of voters) {
    const ward = normalizeText(voter.ward_no);
    if (ward) wards.add(ward);

    const boothKey = getBoothKey(voter);
    const house = normalizeText(voter.house_no);
    if (house) households.add(`${boothKey}:${house}`);

    const booth = boothMap.get(boothKey) ?? {
      key: boothKey,
      boothNo: voter.booth_no,
      boothName: voter.booth_name,
      voters: 0,
      male: 0,
      female: 0,
      other: 0,
      mobile: 0,
      issues: 0
    };
    booth.voters += 1;

    const sex = normalizeSex(voter.sex);
    if (sex === 'male') {
      male += 1;
      booth.male += 1;
    } else if (sex === 'female') {
      female += 1;
      booth.female += 1;
    } else {
      other += 1;
      booth.other += 1;
    }

    if (hasText(voter.mobile_no)) {
      mobile += 1;
      booth.mobile += 1;
    }
    if (hasText(voter.caste)) caste += 1;
    if (hasText(voter.religion)) religion += 1;
    if (hasText(voter.aadhar_card_no)) aadhaar += 1;
    if (hasText(voter.dob)) dob += 1;
    if (typeof voter.age === 'number' && Number.isFinite(voter.age)) {
      age += 1;
      if (voter.age >= 18 && voter.age <= 24) ageBands[0].count += 1;
      else if (voter.age <= 34) ageBands[1].count += 1;
      else if (voter.age <= 44) ageBands[2].count += 1;
      else if (voter.age <= 59) ageBands[3].count += 1;
      else if (voter.age <= 74) ageBands[4].count += 1;
      else ageBands[5].count += 1;
    }
    if (hasText(voter.local_issue)) {
      issues += 1;
      booth.issues += 1;
    }
    if (hasText(voter.interested_party)) interests += 1;

    boothMap.set(boothKey, booth);

    const epic = normalizeText(voter.epic_id);
    if (epic) {
      const ids = epicMap.get(epic) ?? [];
      ids.push(voter.id);
      epicMap.set(epic, ids);
    }

    const householdSignature = [normalizeText(voter.voter_name), normalizeText(voter.relation_name), house, boothKey]
      .filter(Boolean)
      .join('|');
    if (householdSignature.split('|').length === 4) {
      const ids = householdDuplicateMap.get(householdSignature) ?? [];
      ids.push(voter.id);
      householdDuplicateMap.set(householdSignature, ids);
    }
  }

  const duplicateIds = new Set<string>();
  for (const ids of epicMap.values()) {
    if (ids.length > 1) ids.forEach((id) => duplicateIds.add(id));
  }
  for (const ids of householdDuplicateMap.values()) {
    if (ids.length > 1) ids.forEach((id) => duplicateIds.add(id));
  }

  return {
    upload,
    totals: {
      voters: voters.length,
      wards: wards.size,
      booths: boothMap.size,
      households: households.size,
      male,
      female,
      other,
      mobile,
      mobilePct: roundPercent(mobile, voters.length),
      caste,
      religion,
      aadhaar,
      dob,
      age,
      issues,
      interests,
      potentialDuplicates: duplicateIds.size
    },
    ageBands,
    topBooths: [...boothMap.values()]
      .sort((left, right) => right.voters - left.voters || left.key.localeCompare(right.key))
      .slice(0, 8)
  };
}

export async function getCampaignOverview(input: {
  tenantId: string;
  aspirantUserId?: string;
  uploadId?: string;
  boothNos?: string[] | null;
}) {
  let upload = null as UploadRow | null;

  if (input.uploadId) {
    const supabase = await supabaseServer();
    const { data } = await supabase
      .from('uploads')
      .select('id, original_filename, location, row_count, status, created_at, aspirant_name')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.uploadId)
      .maybeSingle();

    upload = (data as UploadRow | null) ?? null;
  } else {
    upload = await findActiveUpload(input.tenantId, input.aspirantUserId);
  }

  if (!upload) return null;

  const voters = await fetchAllVoters(input.tenantId, upload.id, input.boothNos);
  return summarizeOverview(upload, voters);
}


export async function getAdminOpsCounts(tenantId: string): Promise<AdminOpsCounts> {
  const supabase = await supabaseServer();

  const [
    uploadsResult,
    confirmedUploadsResult,
    invitesResult,
    aspirantsResult,
    subUsersResult
  ] = await Promise.all([
    supabase.from('uploads').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('uploads').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'CONFIRMED'),
    supabase.from('phone_invites').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('role', 'ASPIRANT'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('role', 'SUB_USER')
  ]);

  return {
    uploads: uploadsResult.count ?? 0,
    confirmedUploads: confirmedUploadsResult.count ?? 0,
    invites: invitesResult.count ?? 0,
    aspirants: aspirantsResult.count ?? 0,
    subUsers: subUsersResult.count ?? 0
  };
}
