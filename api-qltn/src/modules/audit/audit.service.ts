import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import type { PaginatedResult } from '../../common/interfaces/paginated.interface';
import { pageWindow, type PaginationQueryDto, toPaginated } from '../../common/utils/pagination';
import { AuditEvent, type SubjectType } from './entities/audit-event.entity';

export interface AuditInput {
  subjectType: SubjectType;
  subjectId: string;
  buildingId: string | null;
  action: string;
  actorId: string | null;
  entityVersion?: number;
  fromStatus?: string;
  toStatus?: string;
  reason?: string;
}

export interface AuditEventView {
  id: string;
  subjectType: SubjectType;
  subjectId: string;
  buildingId: string | null;
  action: string;
  actorId: string | null;
  actorName: string | null;
  entityVersion: number | null;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  createdAt: Date;
}

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditEvent) private readonly events: Repository<AuditEvent>) {}

  /** Writes inside the caller's transaction so the trail and the change commit together. */
  async record(manager: EntityManager, input: AuditInput): Promise<void> {
    const repo = manager.getRepository(AuditEvent);
    await repo.insert(
      repo.create({
        ...input,
        entityVersion: input.entityVersion ?? null,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        reason: input.reason ?? null,
        correlationId: RequestContext.correlationId(),
      }),
    );
  }

  /** Newest first. */
  async listForSubject(
    subjectType: SubjectType,
    subjectId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<AuditEventView>> {
    const window = pageWindow(query);
    const qb = this.events
      .createQueryBuilder('e')
      .leftJoin('users', 'u', 'u.id = e.actor_id')
      .select('e')
      .addSelect('u.full_name', 'actor_name')
      .where('e.subject_type = :subjectType AND e.subject_id = :subjectId', { subjectType, subjectId })
      .orderBy('e.created_at', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .offset(window.skip)
      .limit(window.limit);
    const [{ entities, raw }, total] = await Promise.all([qb.getRawAndEntities(), qb.getCount()]);
    const names = raw as Array<{ actor_name: string | null }>;
    const data = entities.map((event, index) => ({
      id: event.id,
      subjectType: event.subjectType,
      subjectId: event.subjectId,
      buildingId: event.buildingId,
      action: event.action,
      actorId: event.actorId,
      actorName: names[index]?.actor_name ?? null,
      entityVersion: event.entityVersion,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      reason: event.reason,
      createdAt: event.createdAt,
    }));
    return toPaginated(data, total, window);
  }
}
