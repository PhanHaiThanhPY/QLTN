import { Link } from 'react-router';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import type { MyDoneRow } from '@/services/my-tasks-service';
import { formatDateTime } from '@/utils/date';

/** "Đã hoàn thành": task, record, when, result (BR-TK-06); no deadline column. */
export const DoneTaskTable = ({ rows }: { rows: readonly MyDoneRow[] }) => (
  <>
    <Table>
      <thead>
        <tr>
          <Th scope="col">Việc</Th>
          <Th scope="col">Hồ sơ</Th>
          <Th scope="col">Thời điểm</Th>
          <Th scope="col">Kết quả</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <Tr key={row.id}>
            <Td className="font-medium text-ink">{row.label}</Td>
            <Td>
              <Link to={row.href} className="font-medium text-accent hover:underline">{row.code}</Link>
              <span className="ml-1 text-ink-2">{row.title}</span>
            </Td>
            <Td className="text-ink-2">{formatDateTime(row.at)}</Td>
            <Td>{row.result}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
    <ul className="space-y-2 md:hidden">
      {rows.map((row) => (
        <li key={row.id}>
          <Link to={row.href} className="block min-h-11 rounded-lg border border-line bg-surface px-3.5 py-3 hover:border-accent/40">
            <span className="block font-medium text-ink">{row.label} · {row.result}</span>
            <span className="block text-sm text-ink-2">{row.code} {row.title}</span>
            <span className="block text-xs text-ink-3">{formatDateTime(row.at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  </>
);
