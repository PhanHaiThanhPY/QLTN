import { AttachmentList } from '@/components/common/AttachmentList';
import { InfoGrid } from '@/components/common/InfoGrid';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { useReferenceData } from '@/hooks/useReferenceData';
import type { InvitationDetail } from '@/services/deposit-api';
import { formatDate } from '@/utils/date';
import { formatVndText } from '@/utils/money';
import { formatVnDateTime } from '@/features/exploitation/exploitation-ui';

/** "MC-001 · Thư mời" (D1 p. 33, left card): the fund, amount, term, deadline and the letter. */
export const InvitationCard = ({ detail }: { detail: InvitationDetail }) => {
  const { buildingName } = useReferenceData();
  const { invitation } = detail;
  const letter = invitation.letterAttachmentId ? detail.files[invitation.letterAttachmentId] : undefined;
  return (
    <Card>
      <CardHeader title={`${invitation.code} · Thư mời`} />
      <CardBody className="space-y-3 pt-0">
        <InfoGrid
          items={[
            { label: 'Quỹ', value: `Quỹ bảo trì ${buildingName(invitation.buildingId)}` },
            { label: 'Số tiền mời gửi', value: formatVndText(invitation.amountVnd) },
            { label: 'Kỳ hạn', value: `${invitation.termDays} ngày` },
            { label: 'Hạn phản hồi', value: invitation.deadlineAt ? formatVnDateTime(invitation.deadlineAt) : 'Chưa đặt' },
            { label: 'Ngày dự kiến gửi tiền', value: invitation.expectedDepositOn ? formatDate(invitation.expectedDepositOn) : '—' },
            { label: 'Ngày gửi thư', value: invitation.sentOn ? formatDate(invitation.sentOn) : 'Chưa gửi' },
          ]}
        />
        {invitation.conditions ? <p className="text-sm text-ink-2">Ghi chú điều kiện: {invitation.conditions}</p> : null}
        <AttachmentList attachments={letter ? [letter] : []} emptyText="Chưa có tệp thư mời." />
        {invitation.statusReason ? <p className="text-sm text-ink-2">Lý do: {invitation.statusReason}</p> : null}
      </CardBody>
    </Card>
  );
};
