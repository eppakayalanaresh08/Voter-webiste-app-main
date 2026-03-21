export type RowValue = string | number | boolean | null | undefined;

export const VOTER_UPLOAD_STRUCTURE_2026 = {
  version: '2026-voter-roll-v1',
  requiredHeaders: [
    'State',
    'District',
    'Revenue_Division',
    'Mandal_or_Tehsil',
    'City_or_Town_or_Village',
    'Ward_No',
    'Booth_No',
    'Serial_No',
    'Voter_Name',
    'Relation_Name',
    'Sex',
    'Age',
    'Date_Of_Birth',
    'House_No',
    'Epic_Id',
    'Booth_Name',
    'Booth_Address',
    'Mobile_No',
    'Caste',
    'Religion',
    'Aadhar_Card_No',
    'Education',
    'Profession',
    'Local Issue',
    'Interested_Party',
    'Voter_Name_Telugu',
    'Relation_Name_Telugu'
  ]
} as const;

export type VoterUploadHeader = (typeof VOTER_UPLOAD_STRUCTURE_2026.requiredHeaders)[number];

export type VoterUploadRow = Partial<Record<VoterUploadHeader, RowValue>> & Record<string, RowValue>;

type NormalizedExtra = {
  sourceSchemaVersion: string;
  sourceGeo: {
    state: RowValue;
    district: RowValue;
    revenue_division: RowValue;
    mandal_or_tehsil: RowValue;
    city_or_town_or_village: RowValue;
  };
  sourceRegional: {
    voter_name_telugu: RowValue;
    relation_name_telugu: RowValue;
    extra_1: RowValue;
    extra_2: RowValue;
    extra_3: RowValue;
    extra_4: RowValue;
  };
  raw: VoterUploadRow;
};

function hasText(value: RowValue) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function get(row: VoterUploadRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (hasText(value)) return value;
  }
  return null;
}

export function getMissingUploadHeaders(headers: string[]) {
  const normalized = new Set(headers.map((header) => header.trim()));
  return VOTER_UPLOAD_STRUCTURE_2026.requiredHeaders.filter((header) => !normalized.has(header));
}

export function normalizeVoterUploadRow(row: VoterUploadRow) {
  const extra: NormalizedExtra = {
    sourceSchemaVersion: VOTER_UPLOAD_STRUCTURE_2026.version,
    sourceGeo: {
      state: get(row, 'State'),
      district: get(row, 'District'),
      revenue_division: get(row, 'Revenue_Division'),
      mandal_or_tehsil: get(row, 'Mandal_or_Tehsil'),
      city_or_town_or_village: get(row, 'City_or_Town_or_Village')
    },
    sourceRegional: {
      voter_name_telugu: get(row, 'Voter_Name_Telugu'),
      relation_name_telugu: get(row, 'Relation_Name_Telugu'),
      extra_1: get(row, '__EMPTY'),
      extra_2: get(row, '__EMPTY_1'),
      extra_3: get(row, '__EMPTY_2'),
      extra_4: get(row, '__EMPTY_3')
    },
    raw: row
  };

  return {
    ward_no: get(row, 'Ward_No', 'Ward No', 'Ward'),
    booth_no: get(row, 'Booth_No', 'Booth No', 'Booth'),
    serial_no: get(row, 'Serial_No', 'Serial No', 'Serial'),

    voter_name: get(row, 'Voter_Name', 'Voter Name', 'Name'),
    relation_name: get(row, 'Relation_Name', 'Relation Name', 'Husband Name', 'Father Name'),
    epic_id: get(row, 'Epic_Id', 'EPIC', 'EPIC ID', 'Epic_Id2'),

    sex: get(row, 'Sex', 'Gender'),
    age: (() => {
      const value = get(row, 'Age');
      const numeric = value === null ? null : Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    })(),
    dob: get(row, 'Date_Of_Birth', 'DOB', 'Date of Birth'),
    house_no: get(row, 'House_No', 'House No', 'House Number'),

    booth_name: get(row, 'Booth_Name', 'Booth Name'),
    booth_address: get(row, 'Booth_Address', 'Booth Address'),

    mobile_no: (() => {
      const value = get(row, 'Mobile_No', 'Mobile No', 'Phone', 'Phone No');
      return value ? String(value).replace(/\s+/g, '') : null;
    })(),

    caste: get(row, 'Caste'),
    religion: get(row, 'Religion'),
    aadhar_card_no: get(row, 'Aadhar_Card_No', 'Aadhar', 'Aadhaar'),
    education: get(row, 'Education'),
    profession: get(row, 'Profession'),
    local_issue: get(row, 'Local Issue', 'Local_Issue'),
    interested_party: get(row, 'Interested_Party', 'Interested Party'),

    voter_name_tamil: get(row, 'Voter_Name_Telugu'),
    relation_name_tamil: get(row, 'Relation_Name_Telugu'),
    booth_name_tamil: get(row, '__EMPTY'),
    booth_address_telugu: get(row, '__EMPTY_1', '__EMPTY_2', '__EMPTY_3'),

    extra
  };
}
