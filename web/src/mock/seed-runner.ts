import type { AttachmentPurpose, SubjectType } from '@/domain/constants';
import type { IsoDate } from '@/domain/types';
import { getDb } from '@/storage/db';
import { addDays, addMonthsClamped, vnDateTimeToIso } from '@/utils/date';
import { executeCommand, executeSystemCommand } from '@/services/command-engine';
import type { CommandResult } from '@/services/command-engine';
import { uploadAttachment } from '@/services/file-service';
import { newId, setFixedNow, setSessionUserId } from '@/services/runtime';
import { makeSamplePdf, makeSamplePng } from './placeholder-files';

const PHOTO_COLORS: [string, string][] = [
  ['#94a3b8', '#cbd5e1'],
  ['#a16207', '#fde68a'],
  ['#0f766e', '#99f6e4'],
  ['#b91c1c', '#fecaca'],
  ['#1d4ed8', '#bfdbfe'],
];

/**
 * Replays demo history through the real command engine at simulated times,
 * so every seeded record has consistent audit, tasks and notifications.
 */
export class SeedRunner {
  readonly seedDate: IsoDate;
  private photoIndex = 0;

  constructor(seedDate: IsoDate) {
    this.seedDate = seedDate;
  }

  /** Date relative to the seed day: D + months (clamped) + days. */
  date(days: number, months = 0): IsoDate {
    return addDays(addMonthsClamped(this.seedDate, months), days);
  }

  at(days: number, hour = 9, minute = 0, months = 0): this {
    setFixedNow(new Date(vnDateTimeToIso(this.date(days, months), hour, minute)));
    return this;
  }

  atDate(date: IsoDate, hour = 9, minute = 0): this {
    setFixedNow(new Date(vnDateTimeToIso(date, hour, minute)));
    return this;
  }

  as(userId: string): this {
    setSessionUserId(userId);
    return this;
  }

  private async currentVersion(subjectType: SubjectType, subjectId?: string): Promise<number | undefined> {
    if (!subjectId) return undefined;
    const db = getDb();
    if (subjectType === 'REPAIR_RECORD') return (await db.records.get(subjectId))?.version;
    if (subjectType === 'MAINTENANCE_OCCURRENCE') return (await db.occurrences.get(subjectId))?.version;
    if (subjectType === 'MAINTENANCE_PLAN') return (await db.maintenancePlans.get(subjectId))?.version;
    return (await db.maintenanceItems.get(subjectId))?.version;
  }

  async run(action: string, subjectType: SubjectType, subjectId: string | undefined, payload: unknown = {}): Promise<CommandResult> {
    return executeCommand({
      commandId: newId('cmd'),
      subjectType,
      subjectId,
      expectedVersion: await this.currentVersion(subjectType, subjectId),
      action,
      payload,
    });
  }

  async system(buildingIds: string[]): Promise<void> {
    await executeSystemCommand({
      commandId: newId('cmd'),
      subjectType: 'MAINTENANCE_PLAN',
      action: 'generateOccurrences',
      payload: { buildingIds },
    });
  }

  async photo(subjectType: SubjectType, subjectId: string, purpose: AttachmentPurpose, name: string): Promise<string> {
    const [a, b] = PHOTO_COLORS[this.photoIndex % PHOTO_COLORS.length];
    this.photoIndex += 1;
    const attachment = await uploadAttachment({ subjectType, subjectId, purpose, file: makeSamplePng(a, b), fileName: `${name}.png` });
    return attachment.id;
  }

  async pdf(subjectType: SubjectType, subjectId: string, purpose: AttachmentPurpose, title: string): Promise<string> {
    const attachment = await uploadAttachment({ subjectType, subjectId, purpose, file: makeSamplePdf(title), fileName: `${title}.pdf` });
    return attachment.id;
  }
}
