import Dexie, { Table } from 'dexie';

export type OfflineVoter = {
  id: string;
  ward_no: string | null;
  booth_no: string | null;
  serial_no: string | null;
  voter_name: string | null;
  voter_name_tamil?: string | null;
  relation_name: string | null;
  relation_name_tamil?: string | null;
  epic_id: string | null;
  sex: string | null;
  age: number | null;
  dob: string | null;
  house_no: string | null;
  booth_name: string | null;
  booth_address: string | null;
  mobile_no: string | null;
  caste: string | null;
  religion: string | null;
  aadhar_card_no: string | null;
  education: string | null;
  profession: string | null;
  local_issue: string | null;
  interested_party: string | null;
  notes: string | null;
  updated_at: string;

  // derived
  name_lc?: string;
  epic_lc?: string;
  phone_norm?: string;
  house_lc?: string;
};

export type PendingEdit = {
  id?: number;
  voterId: string;
  patch: Record<string, unknown>;
  baseUpdatedAt?: string;
  createdAt: string;
};

export type PendingLog = {
  id?: number;
  voterId: string;
  actionType: string;
  payload?: unknown;
  createdAt: string;
};

export type TeamCache = {
  key: string; // tenantId-uploadId
  boothOptions: unknown[];
  assignments: unknown[];
  updatedAt: string;
};

export type HomeCache = {
  key: string; // tenantId-uploadId
  overview: unknown;
  banners: unknown[];
  updatedAt: string;
};

export class OfflineDB extends Dexie {
  voters!: Table<OfflineVoter, string>;
  meta!: Table<{ key: string; value: unknown }, string>;
  pendingEdits!: Table<PendingEdit, number>;
  pendingLogs!: Table<PendingLog, number>;
  teamCache!: Table<TeamCache, string>;
  homeCache!: Table<HomeCache, string>;

  constructor() {
    super('voter_pwa_db');
    this.version(1).stores({
      voters: 'id, booth_no, epic_lc, phone_norm, house_lc, name_lc',
      meta: 'key',
      pendingEdits: '++id, voterId, createdAt',
      pendingLogs: '++id, voterId, createdAt'
    });

    this.version(2).stores({
      teamCache: 'key'
    });

    this.version(3).stores({
      homeCache: 'key'
    });
  }
}

export const db = new OfflineDB();

export function enrich(v: OfflineVoter): OfflineVoter {
  const phone = (v.mobile_no ?? '').replace(/\D+/g, '');
  const nameLc = (v.voter_name ?? '').toLowerCase();
  return {
    ...v,
    name_lc: nameLc,
    epic_lc: (v.epic_id ?? '').toLowerCase(),
    phone_norm: phone || undefined,
    house_lc: (v.house_no ?? '').toLowerCase()
  };
}
