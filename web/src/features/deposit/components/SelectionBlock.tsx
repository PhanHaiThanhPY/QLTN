import { AttachmentList } from '@/components/common/AttachmentList';
import { Notice } from '@/components/common/Notice';
import { StatusPill } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { useReferenceData } from '@/hooks/useReferenceData';
import type { DepositSelection, InvitationDetail } from '@/services/deposit-api';
import { formatDateTime } from '@/utils/date';
import { formatVndText } from '@/utils/money';
import { DECISION_TEXT, SELECTION_STATUS_TEXT, SELECTION_STATUS_TONE, highestOf } from '../deposit-ui';
import { ComparisonCards } from './ComparisonCards';

export interface ResultRoles {
  manage: boolean;
  approve: boolean;
  viewerId: string;
  writable: boolean;
}

export type Decision = 'approve' | 'requestChanges' | 'reject';
export type Editing = { mode: 'propose' | 'resubmit' | 'change'; selection?: DepositSelection } | null;

interface SelectionBlockProps {
  detail: InvitationDetail;
  selection: DepositSelection;
  roles: ResultRoles;
  onDecide: (selection: DepositSelection, decision: Decision) => void;
  onEdit: (next: Editing) => void;
}

/** One result: the bank (or none), basis, minutes, the warnings BQT must see, the frozen comparison and decisions. */
export const SelectionBlock = ({ detail, selection, roles, onDecide, onEdit }: SelectionBlockProps) => {
  const { userName } = useReferenceData();
  const highest = highestOf(selection.comparison);
  const chosen = selection.comparison.find((row) => row.offerId === selection.offerId);
  const notHighest = selection.kind === 'BANK' && highest && chosen && highest.offerId !== chosen.offerId;
  const minutes = detail.files[selection.minutesAttachmentId];
  const canDecide = roles.approve && roles.writable && selection.status === 'PENDING' && selection.createdBy !== roles.viewerId;
  const changePending = detail.selections.some((row) => row.replacesId === selection.id && (row.status === 'PENDING' || row.status === 'NEEDS_CHANGES'));
  return (
    <Card>
      <CardHeader
        title={`${selection.code} · Kết quả chọn`}
        actions={<StatusPill tone={SELECTION_STATUS_TONE[selection.status]}>{SELECTION_STATUS_TEXT[selection.status]}</StatusPill>}
      />
      <CardBody className="space-y-3 pt-0 text-sm">
        <p className="font-semibold text-ink">{selection.kind === 'BANK' ? (chosen?.bankName ?? detail.banks[selection.bankId ?? '']?.name) : 'Không chọn được ngân hàng'}</p>
        {chosen ? <p className="tabular-nums text-ink-2">Lãi cả kỳ {formatVndText(chosen.interestVnd)}</p> : null}
        {selection.replacesId ? <p className="text-ink-2">Đổi kết quả: {selection.changeReason}</p> : null}
        <p className="text-ink">Căn cứ: {selection.basis}</p>
        {notHighest ? (
          <Notice tone="warning">
            Không phải bản chào có lãi cả kỳ cao nhất (cao nhất: {highest.bankName} · {formatVndText(highest.interestVnd)}).
            {selection.notHighestReason ? <span className="block">Lý do: {selection.notHighestReason}</span> : null}
          </Notice>
        ) : null}
        {selection.lateReason ? <Notice tone="warning">Bản chào trễ hạn được xét. Lý do: {selection.lateReason}</Notice> : null}
        <AttachmentList attachments={minutes ? [{ ...minutes, fileName: `${selection.minutesCode} · ${minutes.fileName}` }] : []} emptyText="Chưa có biên bản." />
        <details className="rounded-lg border border-line p-2">
          <summary className="cursor-pointer text-ink-2">Bảng so sánh lúc gửi duyệt ({selection.comparison.length} bản chào)</summary>
          <div className="mt-2">
            <ComparisonCards
              rows={selection.comparison}
              amountVnd={detail.invitation.amountVnd}
              termDays={detail.invitation.termDays}
              mixedBasis={new Set(selection.comparison.map((row) => row.dayBasis)).size > 1}
              selectedOfferId={selection.offerId}
              compact
            />
          </div>
        </details>
        {canDecide ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onDecide(selection, 'approve')}>
              Duyệt
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onDecide(selection, 'requestChanges')}>
              Yêu cầu sửa
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDecide(selection, 'reject')}>
              Từ chối
            </Button>
          </div>
        ) : null}
        {roles.manage && roles.writable && selection.status === 'NEEDS_CHANGES' ? (
          <Button size="sm" variant="secondary" onClick={() => onEdit({ mode: 'resubmit', selection })}>
            Sửa và gửi lại
          </Button>
        ) : null}
        {roles.manage && roles.writable && selection.status === 'APPROVED' && !changePending ? (
          <Button size="sm" variant="ghost" onClick={() => onEdit({ mode: 'change', selection })}>
            Đổi kết quả
          </Button>
        ) : null}
        <ol className="space-y-1 border-t border-line pt-2 text-xs text-ink-2" aria-label="Lịch sử quyết định">
          {selection.decisions.map((row) => (
            <li key={`${row.decision}-${row.at}`}>
              {formatDateTime(row.at)} · {DECISION_TEXT[row.decision]} · {userName(row.by)}
              {row.reason ? ` · ${row.reason}` : ''}
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
};
