import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { Acceptance, AcceptanceResult } from '@/domain/types';
import { ActorLine } from '../shared/ActorLine';
import { RecordFiles } from '../shared/RecordFiles';
import { REVIEWER_LABEL } from './acceptance-labels';

const RESULT: Record<AcceptanceResult, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Chờ nghiệm thu', tone: 'warn' },
  PASSED: { label: 'Đạt', tone: 'good' },
  FAILED: { label: 'Không đạt', tone: 'crit' },
};

/** One acceptance round with each reviewer's decision (KT, TVKT); failed rounds stay in the list as evidence. */
export const AcceptanceRoundCard = ({ round }: { round: Acceptance }) => (
  <Card>
    <CardHeader
      title={`Lượt nghiệm thu ${round.roundNo}`}
      description={<ActorLine prefix="Gửi bởi" actorId={round.submittedBy} at={round.submittedAt} />}
      actions={<Badge tone={RESULT[round.result].tone}>{RESULT[round.result].label}</Badge>}
    />
    <CardBody className="space-y-3">
      <div>
        <p className="text-xs font-medium text-ink-3">Nội dung gửi nghiệm thu</p>
        <p className="mt-0.5 whitespace-pre-line text-sm text-ink">{round.submissionNote}</p>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-ink-3">Ảnh kết quả</p>
        <RecordFiles ids={round.attachmentIds} />
      </div>
      {round.checks.map((check) => (
        <div key={`${check.reviewer}-${check.checkedAt}`} className="rounded-lg bg-surface-2 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ink-2">{REVIEWER_LABEL[check.reviewer]}</span>
            <Badge tone={check.passed ? 'good' : 'crit'}>{check.passed ? 'Đạt' : 'Không đạt'}</Badge>
          </div>
          <p className="mt-1 whitespace-pre-line text-sm text-ink">{check.note}</p>
          <ActorLine actorId={check.actorId} at={check.checkedAt} />
          {check.reportAttachmentIds.length > 0 ? (
            <div className="mt-2">
              <RecordFiles ids={check.reportAttachmentIds} />
            </div>
          ) : null}
        </div>
      ))}
    </CardBody>
  </Card>
);
