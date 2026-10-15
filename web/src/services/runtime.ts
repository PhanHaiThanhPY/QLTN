import { toVnDate } from '@/utils/date';
import type { IsoDate } from '@/domain/types';

/**
 * Runtime hooks for time, ids and the demo session.
 * The seed script overrides the clock to replay history in chronological order.
 */
let fixedNow: Date | null = null;
let idCounter = 0;
let sequentialIds = false;
let sessionUserId: string | null = null;

export const now = (): Date => (fixedNow ? new Date(fixedNow.getTime()) : new Date());
export const nowIso = (): string => now().toISOString();
export const todayVn = (): IsoDate => toVnDate(now());

export const setFixedNow = (value: Date | null): void => {
  fixedNow = value;
};

export const enableSequentialIds = (enabled: boolean): void => {
  sequentialIds = enabled;
  idCounter = 0;
};

export const newId = (prefix: string): string => {
  if (sequentialIds) {
    idCounter += 1;
    return `${prefix}-${String(idCounter).padStart(5, '0')}`;
  }
  return `${prefix}-${crypto.randomUUID()}`;
};

export const getSessionUserId = (): string | null => sessionUserId;
export const setSessionUserId = (userId: string | null): void => {
  sessionUserId = userId;
};
