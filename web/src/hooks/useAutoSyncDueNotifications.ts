import { useEffect } from 'react';
import { IS_API_MODE } from '@/config/data-source';
import { executeSystemCommand } from '@/services/command-engine';
import { newId, todayVn } from '@/services/runtime';
import type { User } from '@/domain/types';

const lastRun = new Map<string, string>();

/** Runs the demo reminder sweep once per viewer session and day. Skipped in api mode (Dexie is not the source of truth). */
export const useAutoSyncDueNotifications = (viewer: User | undefined): void => {
  useEffect(() => {
    if (IS_API_MODE || !viewer) return;
    const key = `${viewer.id}|${todayVn()}`;
    if (lastRun.get(viewer.id) === key) return;
    lastRun.set(viewer.id, key);
    executeSystemCommand(
      {
        commandId: newId('cmd'),
        subjectType: 'BUILDING',
        action: 'syncDueNotifications',
        payload: { buildingIds: viewer.buildingIds },
      },
      viewer.id,
    ).catch((error: unknown) => {
      lastRun.delete(viewer.id);
      console.error('Due notification sync failed:', error);
    });
  }, [viewer]);
};
