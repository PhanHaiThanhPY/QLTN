import { useEffect } from 'react';
import { executeSystemCommand } from '@/services/command-engine';
import { newId, todayVn } from '@/services/runtime';
import type { User } from '@/domain/types';

const lastRun = new Map<string, string>();

/**
 * Runs schedule generation as SYSTEM when a viewer opens Overview or Maintenance screens (spec 6.5).
 * Repeats are harmless (unique key per period); this only avoids redundant runs in one day.
 */
export const useAutoGenerateSchedule = (viewer: User | undefined): void => {
  useEffect(() => {
    if (!viewer) return;
    const key = `${viewer.id}|${todayVn()}`;
    if (lastRun.get(viewer.id) === key) return;
    lastRun.set(viewer.id, key);
    executeSystemCommand(
      { commandId: newId('cmd'), subjectType: 'MAINTENANCE_PLAN', action: 'generateOccurrences', payload: { buildingIds: viewer.buildingIds } },
      viewer.id,
    ).catch((error: unknown) => {
      lastRun.delete(viewer.id);
      console.error('Schedule generation failed:', error);
    });
  }, [viewer]);
};
