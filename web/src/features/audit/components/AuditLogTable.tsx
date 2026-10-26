import { Link } from 'react-router';
import { Table, TableScroll, Td, Th, Tr } from '@/components/ui/table';
import { auditActionLabel, auditSubjectLabel } from '@/domain/audit-labels';
import { REPAIR_STATUS_LABEL } from '@/domain/constants';
import type { User } from '@/domain/types';
import type { AuditLogRow } from '@/services/http/audit-log-api';
import { formatDateTime } from '@/utils/date';
import { subjectLink } from '../audit-links';

const statusLabel = (status: string | null): string =>
  status ? ((REPAIR_STATUS_LABEL as Record<string, string>)[status] ?? status) : '';

const actorOf = (row: AuditLogRow): string =>
  row.actorId ? `${row.actorName ?? ''} (${row.actorCode ?? ''})` : 'Hệ thống';

interface AuditLogTableProps {
  rows: readonly AuditLogRow[];
  viewer: User | undefined;
}

/** Rows of the operation log (SPEC AD-S1 §3 step 4); the subject code links to its screen when allowed (BR-06). */
export const AuditLogTable = ({ rows, viewer }: AuditLogTableProps) => (
  <TableScroll>
    <Table>
      <thead>
        <Tr>
          <Th>Thời điểm</Th>
          <Th>Tòa</Th>
          <Th>Người thực hiện</Th>
          <Th>Đối tượng</Th>
          <Th>Hành động</Th>
          <Th>Trạng thái</Th>
          <Th>Lý do / ghi chú</Th>
        </Tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const link = subjectLink(row, viewer);
          const code = row.subjectCode ?? '—';
          const from = statusLabel(row.fromStatus);
          const to = statusLabel(row.toStatus);
          return (
            <Tr key={row.id}>
              <Td className="whitespace-nowrap">{formatDateTime(row.createdAt)}</Td>
              <Td>{row.buildingCode ?? 'Toàn hệ thống'}</Td>
              <Td>{actorOf(row)}</Td>
              <Td>
                <span className="block text-xs text-ink-3">{auditSubjectLabel(row.subjectType)}</span>
                {link ? (
                  <Link to={link} className="font-semibold text-accent hover:underline">
                    {code}
                  </Link>
                ) : (
                  <span className="font-semibold text-ink">{code}</span>
                )}
              </Td>
              <Td className="text-ink">{auditActionLabel(row.action)}</Td>
              <Td className="whitespace-nowrap">{from || to ? `${from || '—'} → ${to || '—'}` : ''}</Td>
              <Td className="max-w-xs whitespace-pre-line break-words">{row.reason ?? ''}</Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  </TableScroll>
);
