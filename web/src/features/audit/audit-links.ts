import { hasCapability, type Capability } from '@/domain/permissions';
import type { User } from '@/domain/types';
import type { AuditLogRow } from '@/services/http/audit-log-api';

/** Screen that opens each subject type, and the capability needed to open it (SPEC AD-S1 BR-06). */
const SUBJECT_SCREENS: Readonly<Record<string, { capability: Capability; path: (id: string) => string }>> = {
  REPAIR_RECORD: { capability: 'VIEW', path: (id) => `/records/${id}` },
  BUILDING: { capability: 'BUILDING_CONFIG', path: (id) => `/settings/buildings?b=${id}` },
  ACCOUNT: { capability: 'ADMIN_VIEW', path: (id) => `/admin/employees?open=${id}` },
  ROLE: { capability: 'ADMIN_VIEW', path: (id) => `/admin/roles?open=${id}` },
  DEPARTMENT: { capability: 'ADMIN_VIEW', path: (id) => `/admin/departments?open=${id}` },
};

/** Link to the subject's own screen, or null when the viewer may not open it or the module is not on the API yet. */
export const subjectLink = (row: Pick<AuditLogRow, 'subjectType' | 'subjectId'>, viewer: User | undefined): string | null => {
  const screen = SUBJECT_SCREENS[row.subjectType];
  if (!screen || !viewer || !hasCapability(viewer, screen.capability)) return null;
  return screen.path(encodeURIComponent(row.subjectId));
};
