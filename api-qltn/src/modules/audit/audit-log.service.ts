import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type SelectQueryBuilder } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { fieldError } from '../../common/validation/field-errors';
import type { PaginatedResult } from '../../common/interfaces/paginated.interface';
import { pageWindow, toPaginated } from '../../common/utils/pagination';
import { VN_TIME_ZONE, vnDate } from '../../common/utils/vn-date';
import { auditActionLabel, auditSubjectLabel } from '../../domain/audit-labels';
import { recordStatusLabel } from '../records/record-actions';
import { AuditService } from './audit.service';
import type { AuditLogExportQueryDto, AuditLogQueryDto } from './dto/audit-log-query.dto';
import { AuditEvent, SUBJECT_TYPE, type SubjectType } from './entities/audit-event.entity';

const TIME_ZONE = VN_TIME_ZONE;
const DEFAULT_DAYS = 7;
const MAX_RANGE_DAYS = 366;
const MAX_EXPORT_ROWS = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Lets Excel read Vietnamese text in the CSV (BR-07). */
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/** One row of the operation log: the stored event plus the display codes of its subject, building and actor. */
export interface AuditLogRow {
  id: string;
  subjectType: SubjectType;
  subjectId: string;
  subjectCode: string | null;
  buildingId: string | null;
  buildingCode: string | null;
  action: string;
  actorId: string | null;
  actorName: string | null;
  actorCode: string | null;
  entityVersion: number | null;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  correlationId: string | null;
  createdAt: Date;
}

export interface AuditCsvFile {
  fileName: string;
  content: Buffer;
}

interface RawRow {
  id: string;
  subject_type: SubjectType;
  subject_id: string;
  subject_code: string | null;
  building_id: string | null;
  building_code: string | null;
  action: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_code: string | null;
  entity_version: number | null;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  correlation_id: string | null;
  created_at: Date;
}

/** Display code of the subject, resolved per subject type (maintenance subjects are not served by the API yet). */
const SUBJECT_CODE_SQL = `CASE e.subject_type
  WHEN 'REPAIR_RECORD' THEN rr.code
  WHEN 'BUILDING' THEN sb.code
  WHEN 'ACCOUNT' THEN su.code
  WHEN 'ROLE' THEN ro.code
  WHEN 'DEPARTMENT' THEN de.code
END`;

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (char) => `\\${char}`);

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const shiftDays = (isoDate: string, days: number): string =>
  new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

const toRow = (raw: RawRow): AuditLogRow => ({
  id: raw.id,
  subjectType: raw.subject_type,
  subjectId: raw.subject_id,
  subjectCode: raw.subject_code,
  buildingId: raw.building_id,
  buildingCode: raw.building_code,
  action: raw.action,
  actorId: raw.actor_id,
  actorName: raw.actor_name,
  actorCode: raw.actor_code,
  entityVersion: raw.entity_version,
  fromStatus: raw.from_status,
  toStatus: raw.to_status,
  reason: raw.reason,
  correlationId: raw.correlation_id,
  createdAt: raw.created_at,
});

const csvCell = (value: string): string => (/[",\r\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

const CSV_HEADER = [
  'Thời điểm',
  'Tòa',
  'Người thực hiện',
  'Loại đối tượng',
  'Mã đối tượng',
  'Hành động',
  'Trạng thái trước',
  'Trạng thái sau',
  'Lý do / ghi chú',
  'correlationId',
];

/**
 * Operation log across subjects (SPEC AD-S1). Read only: there is no way to change or delete an event (BR-03).
 * Rows of a building show only inside the caller's building scope; system-wide rows (no building) only to ADMIN.
 */
@Injectable()
export class AuditLogService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthenticatedUser, query: AuditLogQueryDto): Promise<PaginatedResult<AuditLogRow>> {
    const window = pageWindow(query);
    const qb = this.filtered(actor, query);
    if (!qb) return toPaginated([], 0, window);
    const [raw, total] = await Promise.all([
      this.selectRows(qb.clone()).offset(window.skip).limit(window.limit).getRawMany<RawRow>(),
      qb.getCount(),
    ]);
    return toPaginated(raw.map(toRow), total, window);
  }

  /** CSV of the same filter, UTF-8 with BOM; refused above 10 000 rows; the export itself is audited (BR-07). */
  async exportCsv(actor: AuthenticatedUser, query: AuditLogExportQueryDto): Promise<AuditCsvFile> {
    const qb = this.filtered(actor, query);
    const total = qb ? await qb.getCount() : 0;
    if (total > MAX_EXPORT_ROWS) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Kết quả có ${total} dòng, vượt giới hạn ${MAX_EXPORT_ROWS.toLocaleString('vi-VN')}. Vui lòng thu hẹp khoảng thời gian hoặc bộ lọc.`,
        details: { reason: 'too_many_rows', total, limit: MAX_EXPORT_ROWS },
      });
    }
    const rows = qb ? (await this.selectRows(qb).getRawMany<RawRow>()).map(toRow) : [];
    const lines = [CSV_HEADER, ...rows.map((row) => this.csvLine(row))].map((cells) => cells.map(csvCell).join(','));
    const now = new Date();
    await this.dataSource.transaction((manager) =>
      this.audit.record(manager, {
        subjectType: SUBJECT_TYPE.ACCOUNT,
        subjectId: actor.id,
        buildingId: null,
        action: 'exportAuditLog',
        actorId: actor.id,
        reason: this.describeFilter(query, rows.length),
      }),
    );
    const stamp = dateTimeFormatter.formatToParts(now);
    const part = (type: string): string => stamp.find((item) => item.type === type)?.value ?? '';
    return {
      fileName: `nhat-ky-thao-tac-${part('year')}${part('month')}${part('day')}-${part('hour')}${part('minute')}.csv`,
      content: Buffer.concat([UTF8_BOM, Buffer.from(`${lines.join('\r\n')}\r\n`, 'utf8')]),
    };
  }

  /**
   * Shared filter: scope, period (default 7 days, at most 366), actor, subject type, action and subject code.
   * `null` when the requested building is outside the scope, so the caller answers an empty result.
   */
  private filtered(actor: AuthenticatedUser, query: AuditLogExportQueryDto): SelectQueryBuilder<AuditEvent> | null {
    const { from, to } = this.period(query);
    if (query.buildingId && !actor.buildingIds.includes(query.buildingId)) return null;

    const qb = this.dataSource
      .getRepository(AuditEvent)
      .createQueryBuilder('e')
      .leftJoin('repair_records', 'rr', `e.subject_type = 'REPAIR_RECORD' AND rr.id = e.subject_id`)
      .leftJoin('buildings', 'sb', `e.subject_type = 'BUILDING' AND sb.id = e.subject_id`)
      .leftJoin('users', 'su', `e.subject_type = 'ACCOUNT' AND su.id = e.subject_id`)
      .leftJoin('role_definitions', 'ro', `e.subject_type = 'ROLE' AND ro.id = e.subject_id`)
      .leftJoin('departments', 'de', `e.subject_type = 'DEPARTMENT' AND de.id = e.subject_id`)
      .leftJoin('buildings', 'eb', 'eb.id = e.building_id')
      .leftJoin('users', 'ea', 'ea.id = e.actor_id')
      .where(`e.created_at >= (CAST(:from AS date)::timestamp AT TIME ZONE '${TIME_ZONE}')`, { from })
      .andWhere(`e.created_at < ((CAST(:to AS date) + 1)::timestamp AT TIME ZONE '${TIME_ZONE}')`, { to });

    if (query.buildingId) {
      qb.andWhere('e.building_id = :buildingId', { buildingId: query.buildingId });
    } else {
      // BR-02: system-wide rows (no building) are ADMIN only; the location scope does not apply to the log.
      const scope = actor.buildingIds.length > 0 ? actor.buildingIds : ['00000000-0000-0000-0000-000000000000'];
      const global = actor.role === 'ADMIN' ? ' OR e.building_id IS NULL' : '';
      qb.andWhere(`(e.building_id IN (:...scope)${global})`, { scope });
    }
    if (query.actorId) qb.andWhere('e.actor_id = :actorId', { actorId: query.actorId });
    if (query.subjectType) qb.andWhere('e.subject_type = :subjectType', { subjectType: query.subjectType });
    if (query.action) qb.andWhere('e.action = :action', { action: query.action });
    if (query.subjectCode) {
      qb.andWhere(`lower(${SUBJECT_CODE_SQL}) LIKE '%' || lower(:subjectCode) || '%' ESCAPE '\\'`, {
        subjectCode: escapeLike(query.subjectCode),
      });
    }
    return qb;
  }

  private selectRows(qb: SelectQueryBuilder<AuditEvent>): SelectQueryBuilder<AuditEvent> {
    return qb
      .select([
        'e.id AS id',
        'e.subject_type AS subject_type',
        'e.subject_id AS subject_id',
        'e.building_id AS building_id',
        'e.action AS action',
        'e.actor_id AS actor_id',
        'e.entity_version AS entity_version',
        'e.from_status AS from_status',
        'e.to_status AS to_status',
        'e.reason AS reason',
        'e.correlation_id AS correlation_id',
        'e.created_at AS created_at',
        'eb.code AS building_code',
        'ea.full_name AS actor_name',
        'ea.code AS actor_code',
      ])
      .addSelect(SUBJECT_CODE_SQL, 'subject_code')
      .orderBy('e.created_at', 'DESC')
      .addOrderBy('e.id', 'DESC');
  }

  /** Default: the last 7 days in Vietnam time; an inverted or longer-than-366-days period is refused. */
  private period(query: AuditLogExportQueryDto): { from: string; to: string } {
    const to = query.dateTo ?? vnDate(new Date());
    const from = query.dateFrom ?? shiftDays(to, -(DEFAULT_DAYS - 1));
    const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS + 1;
    if (days < 1) throw fieldError('dateFrom', 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
    if (days > MAX_RANGE_DAYS) throw fieldError('dateTo', `Khoảng thời gian tối đa ${MAX_RANGE_DAYS} ngày.`);
    return { from, to };
  }

  private csvLine(row: AuditLogRow): string[] {
    const actor = row.actorId ? `${row.actorName ?? ''} (${row.actorCode ?? ''})` : 'Hệ thống';
    return [
      dateTimeFormatter.format(row.createdAt).replace(',', ''),
      row.buildingCode ?? 'Toàn hệ thống',
      actor,
      auditSubjectLabel(row.subjectType),
      row.subjectCode ?? '',
      auditActionLabel(row.action),
      row.fromStatus ? recordStatusLabel(row.fromStatus) : '',
      row.toStatus ? recordStatusLabel(row.toStatus) : '',
      row.reason ?? '',
      row.correlationId ?? '',
    ];
  }

  /** Filter recorded on the `exportAuditLog` row (ADMIN-only, system-wide). */
  private describeFilter(query: AuditLogExportQueryDto, rowCount: number): string {
    const { from, to } = this.period(query);
    const parts = [`${from} → ${to}`];
    if (query.buildingId) parts.push(`tòa ${query.buildingId}`);
    if (query.actorId) parts.push(`người làm ${query.actorId}`);
    if (query.subjectType) parts.push(`loại ${query.subjectType}`);
    if (query.action) parts.push(`hành động ${query.action}`);
    if (query.subjectCode) parts.push(`mã ${query.subjectCode}`);
    parts.push(`${rowCount} dòng`);
    return parts.join('; ');
  }
}
