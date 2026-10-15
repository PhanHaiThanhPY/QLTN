import { ArrowUpRight } from 'lucide-react';
import { SubjectTypeBadge } from '@/features/tasks/components/SubjectTypeBadge';
import { Tag, StatusPill } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import type { NotificationKind } from '@/domain/constants';
import type { NotificationView } from '@/services/tasks-service';
import { formatDateTime } from '@/utils/date';
import { cn } from '@/lib/cn';

interface NotificationTableProps {
  rows: NotificationView[];
  buildingName: (id?: string) => string;
  markingId: string | null;
  onOpen: (view: NotificationView) => void;
  onMarkRead: (view: NotificationView) => void;
}

const KIND_LABEL: Record<NotificationKind, string> = {
  WORK_ASSIGNED: 'Công việc mới',
  TASK_DUE_SOON: 'Sắp đến hạn',
  TASK_OVERDUE: 'Quá hạn',
};

const kindLabel = (kind: NotificationKind | undefined): string => KIND_LABEL[kind ?? 'WORK_ASSIGNED'];

/** Desktop notification list with operational columns; mobile keeps the compact card list. */
export const NotificationTable = ({ rows, buildingName, markingId, onOpen, onMarkRead }: NotificationTableProps) => (
  <Table className="min-w-[64rem]">
    <thead>
      <tr>
        <Th className="w-[10rem]">Loại</Th>
        <Th>Nội dung</Th>
        <Th className="w-[10rem]">Tòa nhà</Th>
        <Th className="w-[10.5rem]">Thời gian</Th>
        <Th className="w-[8rem]">Trạng thái</Th>
        <Th className="w-[13rem]">Thao tác</Th>
      </tr>
    </thead>
    <tbody>
      {rows.map((view) => {
        const { notification } = view;
        const isUnread = !notification.readAt;
        return (
          <Tr key={notification.id} className={cn(isUnread && 'bg-accent-soft/25')}>
            <Td>
              <div className="flex flex-wrap items-center gap-1.5">
                <SubjectTypeBadge subjectType={notification.subjectType} />
                <span className="text-xs text-ink-3">{kindLabel(notification.kind)}</span>
              </div>
            </Td>
            <Td>
              <button type="button" className="block max-w-[30rem] text-left" onClick={() => onOpen(view)}>
                <span className={cn('block truncate text-sm text-ink', isUnread ? 'font-semibold' : 'font-medium')}>
                  {notification.title}
                </span>
                {notification.message ? <span className="mt-0.5 block truncate text-xs text-ink-2">{notification.message}</span> : null}
                {view.subjectCode ? <Tag className="mt-1">{view.subjectCode}</Tag> : null}
              </button>
            </Td>
            <Td className="text-xs text-ink-2">{buildingName(notification.buildingId)}</Td>
            <Td className="tnum whitespace-nowrap text-xs text-ink-2">{formatDateTime(notification.createdAt)}</Td>
            <Td>
              <StatusPill tone={isUnread ? 'accent' : 'neutral'}>{isUnread ? 'Chưa đọc' : 'Đã đọc'}</StatusPill>
            </Td>
            <Td>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => onOpen(view)}>
                  Xem <ArrowUpRight className="size-3.5" />
                </Button>
                {isUnread ? (
                  <Button variant="secondary" size="sm" isLoading={markingId === notification.id} onClick={() => onMarkRead(view)}>
                    Đã đọc
                  </Button>
                ) : null}
              </div>
            </Td>
          </Tr>
        );
      })}
    </tbody>
  </Table>
);
