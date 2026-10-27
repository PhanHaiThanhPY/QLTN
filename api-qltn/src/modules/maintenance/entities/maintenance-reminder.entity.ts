import { Column, Entity, PrimaryColumn } from 'typeorm';

export const REMINDER_KINDS = ['DUE_TODAY', 'OVERDUE', 'REVIEW_OVERDUE'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** A reminder already sent (SPEC MT-S3 BR-MT3-10, D-MT3-7): each kind once per occurrence. */
@Entity('maintenance_reminders')
export class MaintenanceReminder {
  @PrimaryColumn({ name: 'occurrence_id', type: 'uuid' })
  occurrenceId: string;

  @PrimaryColumn({ type: 'varchar', length: 20 })
  kind: ReminderKind;

  @Column({ name: 'sent_at', type: 'timestamptz', default: () => 'now()' })
  sentAt: Date;
}
