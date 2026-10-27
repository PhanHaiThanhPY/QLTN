import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import type { PaginatedResult } from '../../common/interfaces/paginated.interface';
import { pageWindow, toPaginated } from '../../common/utils/pagination';
import { vnDate } from '../../common/utils/vn-date';
import { AuditEvent, SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import type { SchedulePageQueryDto, ScheduleQueryDto } from './dto/schedule-query.dto';
import { RepairConstruction } from './entities/repair-construction.entity';
import { RepairRecord } from './entities/repair-record.entity';
import { applyRecordScope, isOutOfScope } from './record-scope-query';
import { toRecordView, type RepairRecordView } from './record-view';
import {
  isConstructionLate,
  scheduleSpan,
  spanOverlaps,
  SPAN_END_UPPER_BOUND_SQL,
  type ScheduleSpan,
} from './schedule-span';

const READY_FOR_CONSTRUCTION = 'READY_FOR_CONSTRUCTION';

/** One started construction on the calendar (B4-S1 BR-B4-01, BR-B4-04, BR-B4-07). */
export interface ScheduleEntryView {
  record: RepairRecordView;
  construction: { startDate: string; plannedEndDate: string; completedDate: string | null; progressPercent: number };
  /** Days the entry occupies, Vietnam time; computed here so the web never derives it on its own. */
  span: ScheduleSpan;
  /** "Trễ thi công" (BR-B4-04). */
  isLate: boolean;
}

/** An approved record whose construction has not started yet ("Chờ xếp lịch", BR-B4-05). */
export interface AwaitingScheduleView {
  record: RepairRecordView;
  /** When the record entered READY_FOR_CONSTRUCTION, from its audit trail; null when no event says so. */
  readySince: Date | null;
}

const byStartThenCode = (a: ScheduleEntryView, b: ScheduleEntryView): number =>
  a.span.start.localeCompare(b.span.start) || a.record.code.localeCompare(b.record.code);

/** Oldest first; a record without a ready event goes last, then by code (BR-B4-08). */
const byReadySince = (a: AwaitingScheduleView, b: AwaitingScheduleView): number => {
  const left = a.readySince?.getTime() ?? Number.POSITIVE_INFINITY;
  const right = b.readySince?.getTime() ?? Number.POSITIVE_INFINITY;
  return left - right || a.record.code.localeCompare(b.record.code);
};

/** Read-only construction calendar of the repair records (SPEC B4-S1). No permission beyond seeing the record list. */
@Injectable()
export class ScheduleService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Started constructions in the caller's buildings whose span shares a day with `from`–`to`. SQL narrows the rows
   * with an upper bound of the span end; the exact span, the overlap and the late flag come from `schedule-span.ts`.
   * The page is cut after sorting, so `meta.total` counts every matching record (BR-B4-06).
   */
  async list(actor: AuthenticatedUser, query: ScheduleQueryDto): Promise<PaginatedResult<ScheduleEntryView>> {
    const window = pageWindow(query);
    if (isOutOfScope(actor, query.buildingId)) return toPaginated([], 0, window);
    const today = vnDate(new Date());
    const qb = applyRecordScope(this.dataSource.getRepository(RepairRecord).createQueryBuilder('r'), actor, query);
    qb.innerJoin(RepairConstruction, 'c', 'c.record_id = r.id');
    if (query.to) qb.andWhere('c.start_date <= :to', { to: query.to });
    if (query.from) qb.andWhere(`${SPAN_END_UPPER_BOUND_SQL} >= :from`, { from: query.from, today });
    const records = await qb.getMany();
    const constructions = records.length
      ? await this.dataSource.getRepository(RepairConstruction).findBy({ recordId: In(records.map((row) => row.id)) })
      : [];
    const constructionOf = new Map(constructions.map((row) => [row.recordId, row]));
    const entries = records
      .flatMap((record): ScheduleEntryView[] => {
        const construction = constructionOf.get(record.id);
        if (!construction) return [];
        const span = scheduleSpan(construction, record.status, today);
        if (!spanOverlaps(span, query.from, query.to)) return [];
        return [
          {
            record: toRecordView(record),
            construction: {
              startDate: construction.startDate,
              plannedEndDate: construction.plannedEndDate,
              completedDate: construction.completedDate,
              progressPercent: construction.progressPercent,
            },
            span,
            isLate: isConstructionLate(construction, record.status, today),
          },
        ];
      })
      .sort(byStartThenCode);
    return toPaginated(entries.slice(window.skip, window.skip + window.limit), entries.length, window);
  }

  /** "Chờ xếp lịch": READY_FOR_CONSTRUCTION records under the building and location filters, oldest approval first. */
  async awaiting(
    actor: AuthenticatedUser,
    query: SchedulePageQueryDto,
  ): Promise<PaginatedResult<AwaitingScheduleView>> {
    const window = pageWindow(query);
    if (isOutOfScope(actor, query.buildingId)) return toPaginated([], 0, window);
    const records = await applyRecordScope(
      this.dataSource.getRepository(RepairRecord).createQueryBuilder('r'),
      actor,
      query,
    )
      .andWhere('r.status = :ready', { ready: READY_FOR_CONSTRUCTION })
      .getMany();
    const readyRows = records.length
      ? await this.dataSource
          .getRepository(AuditEvent)
          .createQueryBuilder('a')
          .select('a.subject_id', 'recordId')
          .addSelect('MAX(a.created_at)', 'readySince')
          .where('a.subject_type = :subjectType', { subjectType: SUBJECT_TYPE.REPAIR_RECORD })
          .andWhere('a.subject_id IN (:...ids)', { ids: records.map((row) => row.id) })
          .andWhere('a.to_status = :ready', { ready: READY_FOR_CONSTRUCTION })
          .groupBy('a.subject_id')
          .getRawMany<{ recordId: string; readySince: Date }>()
      : [];
    const readySinceOf = new Map(readyRows.map((row) => [row.recordId, new Date(row.readySince)]));
    const rows = records
      .map((record): AwaitingScheduleView => ({
        record: toRecordView(record),
        readySince: readySinceOf.get(record.id) ?? null,
      }))
      .sort(byReadySince);
    return toPaginated(rows.slice(window.skip, window.skip + window.limit), rows.length, window);
  }
}
