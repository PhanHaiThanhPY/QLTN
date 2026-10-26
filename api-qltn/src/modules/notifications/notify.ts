import type { EntityManager } from 'typeorm';
import { Notification } from './entities/notification.entity';

export interface NotificationInput {
  recipientIds: readonly string[];
  kind: string;
  title: string;
  body: string;
  subjectType: string;
  subjectId: string;
  buildingId: string | null;
}

/** Writes one row per distinct recipient inside the caller's transaction, so the notice commits with the change. */
export const notify = async (manager: EntityManager, input: NotificationInput): Promise<void> => {
  const { recipientIds, ...content } = input;
  const recipients = [...new Set(recipientIds)];
  if (recipients.length === 0) return;
  const repo = manager.getRepository(Notification);
  await repo.insert(recipients.map((recipientId) => repo.create({ ...content, recipientId })));
};
