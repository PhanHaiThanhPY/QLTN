import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { Attachment } from '@/domain/types';
import type { ExecutionOccurrence, Submission } from '@/services/maintenance-occurrences-api';
import { formatDateTime } from '@/utils/date';
import { ItemResultView } from './ItemResultView';

interface SubmissionHistoryProps {
  occurrence: ExecutionOccurrence;
  submissions: Submission[];
  files: Readonly<Record<string, Attachment>>;
  userName: (id?: string) => string;
}

const DECISION_TEXT = { REWORK: 'Yêu cầu làm lại', CONFIRMED: 'Đã xác nhận' } as const;

/** Every submission, read-only, with the rework reasons and decisions (BR-MT3-05, ui-brief §2.2). */
export const SubmissionHistory = ({ occurrence, submissions, files, userName }: SubmissionHistoryProps) => {
  const [open, setOpen] = useState<number | null>(null);
  if (submissions.length === 0) return null;
  return (
    <Card>
      <CardHeader title="Các lần gửi" />
      <CardBody className="space-y-2 pt-0">
        {submissions.map((row) => (
          <div key={row.round} className="rounded-lg border border-line p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-ink">
                Lần gửi {row.round} · {userName(row.submittedBy)} · {formatDateTime(row.submittedAt)}
              </span>
              <Button size="sm" variant="ghost" className="min-h-11" aria-expanded={open === row.round} onClick={() => setOpen(open === row.round ? null : row.round)}>
                {open === row.round ? 'Thu gọn' : `Xem lần ${row.round}`}
              </Button>
            </div>
            {row.decision ? (
              <p className="mt-1 text-ink-2">
                {DECISION_TEXT[row.decision]} · {userName(row.decidedBy ?? undefined)} · {formatDateTime(row.decidedAt ?? undefined)}
                {row.decisionReason ? ` · ${row.decisionReason}` : ''}
              </p>
            ) : (
              <p className="mt-1 text-ink-2">Đang chờ xác nhận.</p>
            )}
            {open === row.round ? (
              <div className="mt-2 space-y-2">
                <p className="text-ink">Kết quả chung: {row.summary}</p>
                {occurrence.checklist.map((item, index) => (
                  <ItemResultView
                    key={item.id}
                    index={index}
                    item={item}
                    entry={row.entries.find((entry) => entry.itemId === item.id)}
                    files={files}
                    highlight={Boolean(row.reworkItems[item.id])}
                  >
                    {row.reworkItems[item.id] ? <p className="mt-1 text-sm text-ink">Cần làm lại: {row.reworkItems[item.id]}</p> : null}
                    {row.resolutions[item.id] ? <p className="mt-1 text-sm text-ink">Hướng xử lý: {row.resolutions[item.id]}</p> : null}
                  </ItemResultView>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </CardBody>
    </Card>
  );
};
