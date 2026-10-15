import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/common/States';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { SUBJECT_TYPE_LABEL } from '@/domain/constants';
import type { MaintenanceOccurrence, User } from '@/domain/types';
import type { ManagerGap } from '@/services/admin-service';
import { subjectPath } from '@/utils/subject-link';
import { ReplaceManagerDialog } from './ReplaceManagerDialog';

interface ManagerGapsCardProps {
  gaps: ManagerGap[];
  users: User[];
  buildingName: (id?: string) => string;
  itemName: (id?: string) => string;
}

/** Open subjects whose managing BQL is inactive; ADMIN may assign a new manager. */
export const ManagerGapsCard = ({ gaps, users, buildingName, itemName }: ManagerGapsCardProps) => {
  const [selected, setSelected] = useState<ManagerGap | null>(null);

  const titleOf = (gap: ManagerGap): string => {
    if (gap.subjectType === 'MAINTENANCE_OCCURRENCE') return itemName((gap.subject as MaintenanceOccurrence).itemId);
    return 'title' in gap.subject ? gap.subject.title : '';
  };
  const labelOf = (gap: ManagerGap): string => `${SUBJECT_TYPE_LABEL[gap.subjectType]} ${gap.subject.code} · ${titleOf(gap)}`;
  const userLabel = (id: string): string => {
    const user = users.find((row) => row.id === id);
    return user ? `${user.fullName} (${user.code})` : id;
  };
  const candidatesFor = (gap: ManagerGap): User[] =>
    users.filter((user) => user.active && user.role === 'BQL' && user.buildingIds.includes(gap.subject.buildingId));

  return (
    <Card>
      <CardHeader
        title="Phân công lại BQL quản lý"
        description="Dùng khi BQL quản lý hồ sơ/lượt/kế hoạch đã ngừng hoạt động. Chỉ khôi phục phân công, không cho ADMIN duyệt hoặc xác nhận thay."
      />
      <CardBody>
        {gaps.length === 0 ? (
          <EmptyState
            title="Hiện không có đối tượng nào cần thay BQL quản lý"
            description="Trong dữ liệu mẫu mọi BQL quản lý đều đang hoạt động (tình huống BQL ngừng hoạt động được kiểm thử ở tầng nghiệp vụ). Khi có hồ sơ, lượt hoặc kế hoạch còn mở mà BQL quản lý đã ngừng hoạt động, chúng sẽ hiện ở đây."
          />
        ) : (
          <ul className="divide-y divide-line">
            {gaps.map((gap) => (
              <li key={gap.subject.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="accent">{SUBJECT_TYPE_LABEL[gap.subjectType]}</Badge>
                    <Link to={subjectPath(gap.subjectType, gap.subject.id)} className="font-medium text-accent hover:underline">
                      {gap.subject.code}
                    </Link>
                  </div>
                  <p className="mt-1 truncate text-sm text-ink">{titleOf(gap)}</p>
                  <p className="text-xs text-ink-2">
                    {buildingName(gap.subject.buildingId)} · BQL hiện tại: {userLabel(gap.subject.managerUserId)}{' '}
                    <span className="text-crit">(ngừng hoạt động)</span>
                  </p>
                </div>
                <Button variant="secondary" size="sm" className="self-start sm:self-center" onClick={() => setSelected(gap)}>
                  Thay BQL quản lý
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      {selected ? (
        <ReplaceManagerDialog
          key={selected.subject.id}
          gap={selected}
          subjectLabel={labelOf(selected)}
          candidates={candidatesFor(selected)}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </Card>
  );
};
