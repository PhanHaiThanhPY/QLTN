import type { OccurrenceKind } from '@/domain/maintenance-types';

interface MaintenanceTypeBadgeProps {
  kind: OccurrenceKind;
}

/** Distinguishes planned maintenance from manually booked appointments. */
export const MaintenanceTypeBadge = ({ kind }: MaintenanceTypeBadgeProps) => {
  const isAppointment = kind === 'MANUAL';
  return (
    <span className={isAppointment ? 'inline-flex rounded-full bg-warn-soft px-2 py-0.5 text-[0.65rem] font-semibold text-warn' : 'inline-flex rounded-full bg-accent-soft px-2 py-0.5 text-[0.65rem] font-semibold text-accent'}>
      {isAppointment ? 'Lịch hẹn' : 'Bảo trì'}
    </span>
  );
};
