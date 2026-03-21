import { db, enrich, type OfflineVoter } from './offline-db';

type OfflinePackResponse = {
  error?: string;
  voters: OfflineVoter[];
  uploadId: string;
  nextCursor: number | null;
};

type SyncResponse = {
  error?: string;
  editsApplied: number;
  logsInserted: number;
};

export async function downloadOfflinePack(onProgress?: (p: { downloaded: number; status: string }) => void) {
  let cursor: number | null = 0;
  let total = 0;

  await db.transaction('rw', db.voters, db.meta, async () => {
    await db.voters.clear();
    await db.meta.put({ key: 'pack_downloaded_at', value: new Date().toISOString() });
  });

  while (cursor !== null) {
    onProgress?.({ downloaded: total, status: 'Downloading...' });

    const res: Response = await fetch(`/api/offline-pack?cursor=${cursor}&limit=2000`);
    if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');

    const json: OfflinePackResponse = await res.json();
    const voters: OfflineVoter[] = json.voters;

    await db.transaction('rw', db.voters, db.meta, async () => {
      await db.meta.put({ key: 'upload_id', value: json.uploadId });
      await db.voters.bulkPut(voters.map(enrich));
    });

    total += voters.length;
    cursor = json.nextCursor;
    onProgress?.({ downloaded: total, status: cursor === null ? 'Completed' : 'Downloading...' });
  }

  return { total };
}

export async function syncPending() {
  const uploadMeta = await db.meta.get('upload_id');
  const uploadId = uploadMeta?.value as string | undefined;
  if (!uploadId) throw new Error('No offline pack found. Download first.');

  const edits = await db.pendingEdits.toArray();
  const logs = await db.pendingLogs.toArray();

  if (!edits.length && !logs.length) return { editsApplied: 0, logsInserted: 0 };

  const res: Response = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      uploadId,
      edits: edits.map((e) => ({ voterId: e.voterId, patch: e.patch, baseUpdatedAt: e.baseUpdatedAt })),
      logs: logs.map((l) => ({ voterId: l.voterId, actionType: l.actionType, payload: l.payload }))
    })
  });

  const json: SyncResponse = await res.json();
  if (!res.ok) {
    console.error('[Sync] Server returned error:', json.error);
    throw new Error(json.error ?? 'Sync failed');
  }

  // Clear pending queues (keep conflicts for later improvement)
  await db.transaction('rw', db.pendingEdits, db.pendingLogs, async () => {
    await db.pendingEdits.clear();
    await db.pendingLogs.clear();
  });

  return json;
}
