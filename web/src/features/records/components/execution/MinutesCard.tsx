import { InfoGrid } from '@/components/common/InfoGrid';
import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Table, TableScroll, Td, Th, Tr } from '@/components/ui/table';
import { ROUND_OUTCOME_LABEL, type AcceptanceRound, type AcceptanceRoundOutcome } from '@/domain/execution';
import { useReferenceData } from '@/hooks/useReferenceData';
import { formatDate, formatDateTime } from '@/utils/date';
import { useRecordContext } from '../../record-context';
import { RecordFiles } from '../shared/RecordFiles';
import { memberHolderId, memberLabel } from './execution-utils';

const OUTCOME_TONE: Readonly<Record<AcceptanceRoundOutcome, BadgeTone>> = {
  PENDING: 'warn',
  PASSED: 'good',
  FAILED: 'crit',
};

/** Read-only acceptance minutes of one round (BR-S3-04): fields of §4.3, every member's conclusion and signature. */
export const MinutesCard = ({ round }: { round: AcceptanceRound }) => {
  const { detail } = useRecordContext();
  const { userName } = useReferenceData();
  const { record } = detail;
  return (
    <Card>
      <CardHeader
        title={`Biên bản nghiệm thu lượt ${round.roundNo}`}
        description={round.closedAt ? `Đã khóa lúc ${formatDateTime(round.closedAt)}` : 'Đang chờ các thành phần quyết định'}
        actions={<Badge tone={OUTCOME_TONE[round.outcome]}>Kết luận chung: {ROUND_OUTCOME_LABEL[round.outcome]}</Badge>}
      />
      <CardBody className="space-y-4">
        <InfoGrid
          items={[
            { label: 'Thời gian nghiệm thu', value: formatDateTime(round.inspectedAt) },
            { label: 'Địa điểm', value: round.inspectionLocation },
            { label: 'Ngày hoàn thành thi công', value: formatDate(round.completedDate) },
            { label: 'Thành phần khác', value: round.otherMembers ?? '—' },
            { label: 'Nội dung nghiệm thu', value: <span className="whitespace-pre-line">{round.content}</span>, wide: true },
          ]}
        />
        <TableScroll>
          <Table>
            <thead>
              <Tr>
                <Th>Thành phần</Th>
                <Th>Người</Th>
                <Th>Kết luận</Th>
                <Th>Điểm cần lưu ý</Th>
                <Th>Chữ ký</Th>
              </Tr>
            </thead>
            <tbody>
              {round.memberStepKeys.map((stepKey) => {
                const decision = round.decisions.find((row) => row.stepKey === stepKey);
                return (
                  <Tr key={stepKey}>
                    <Td className="text-ink">{memberLabel(record, stepKey)}</Td>
                    <Td>{userName(decision?.actorId ?? memberHolderId(record, stepKey))}</Td>
                    <Td>
                      {decision ? (
                        <Badge tone={decision.outcome === 'PASSED' ? 'good' : 'crit'}>
                          {decision.outcome === 'PASSED' ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                        </Badge>
                      ) : (
                        <Badge tone="outline">Chưa quyết định</Badge>
                      )}
                    </Td>
                    <Td className="max-w-xs whitespace-pre-line">{decision?.note ?? ''}</Td>
                    <Td>
                      {decision?.signatureDataUrl ? (
                        <figure>
                          <img
                            src={decision.signatureDataUrl}
                            alt={`Chữ ký – ${memberLabel(record, stepKey)}`}
                            className="h-12 w-32 rounded bg-white object-contain"
                          />
                          <figcaption className="text-xs text-ink-3">{formatDateTime(decision.createdAt)}</figcaption>
                        </figure>
                      ) : null}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableScroll>
        <div>
          <p className="mb-1 text-xs font-medium text-ink-3">Ảnh kết quả</p>
          <RecordFiles ids={round.photoAttachmentIds} />
        </div>
      </CardBody>
    </Card>
  );
};
