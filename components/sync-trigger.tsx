'use client';

import { useEffect, useRef } from 'react';
import { syncPending } from '@/lib/offline-sync';

export default function SyncTrigger() {
  const isSyncing = useRef(false);

  useEffect(() => {
    const triggerSync = async () => {
      if (isSyncing.current) return;
      if (!navigator.onLine) return;

      isSyncing.current = true;
      try {
        console.log('[SyncTrigger] Starting background sync...');
        const result = await syncPending();
        if (result.editsApplied > 0 || result.logsInserted > 0) {
          console.log(`[SyncTrigger] Sync successful: ${result.editsApplied} edits, ${result.logsInserted} logs.`);
        }
      } catch (err) {
        console.error('[SyncTrigger] Background sync failed:', err);
      } finally {
        isSyncing.current = false;
      }
    };

    // Sync on mount
    void triggerSync();

    // Periodic sync every 2 minutes
    const interval = setInterval(() => {
      void triggerSync();
    }, 2 * 60 * 1000);

    // Sync when coming back online
    window.addEventListener('online', () => void triggerSync());

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', () => void triggerSync());
    };
  }, []);

  return null;
}
