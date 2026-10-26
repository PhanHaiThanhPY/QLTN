import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { notFound } from '../../common/errors';
import type { PaginatedResult } from '../../common/interfaces/paginated.interface';
import { pageWindow, toPaginated, type PaginationQueryDto } from '../../common/utils/pagination';
import { Notification } from './entities/notification.entity';

export interface NotificationView {
  id: string;
  kind: string;
  title: string;
  body: string;
  subjectType: string;
  subjectId: string;
  buildingId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

const toView = (row: Notification): NotificationView => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  body: row.body,
  subjectType: row.subjectType,
  subjectId: row.subjectId,
  buildingId: row.buildingId,
  readAt: row.readAt,
  createdAt: row.createdAt,
});

/** The caller's own notifications only (SPEC B03–B09 v2 BR-S3-01a); the full module is B14. */
@Injectable()
export class NotificationsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(actor: AuthenticatedUser, query: PaginationQueryDto): Promise<PaginatedResult<NotificationView>> {
    const window = pageWindow(query);
    const [rows, total] = await this.dataSource.getRepository(Notification).findAndCount({
      where: { recipientId: actor.id },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: window.skip,
      take: window.limit,
    });
    return toPaginated(rows.map(toView), total, window);
  }

  async unreadCount(actor: AuthenticatedUser): Promise<{ unread: number }> {
    const unread = await this.dataSource
      .getRepository(Notification)
      .countBy({ recipientId: actor.id, readAt: IsNull() });
    return { unread };
  }

  /** Marks one of the caller's notifications read; another user's id answers 404. Reading twice keeps the first time. */
  async markRead(actor: AuthenticatedUser, id: string): Promise<NotificationView> {
    const repo = this.dataSource.getRepository(Notification);
    const row = await repo.findOneBy({ id, recipientId: actor.id });
    if (!row) throw notFound('Không tìm thấy thông báo.');
    if (!row.readAt) {
      row.readAt = new Date();
      await repo.save(row);
    }
    return toView(row);
  }
}
