import { useState } from 'react';
import { SignaturePad } from '@/components/common/SignaturePad';
import { Field } from '@/components/ui/field';
import { NativeSelect, Textarea } from '@/components/ui/input';
import { LIMITS } from '@/domain/constants';
import { formatVndString, type QuoteSubmission } from '@/domain/quote-proposal';
import type { WorkflowApprovalStep } from '@/domain/types';
import { useAttachmentDraft } from '../../hooks/useAttachmentDraft';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { useRecordContext } from '../../record-context';
import { AttachmentField } from '../shared/AttachmentField';
import { CommandDialog } from '../shared/CommandDialog';
import { FieldErrorList } from '../shared/FieldErrorList';

export type QuoteDecisionMode = 'approveProposal' | 'requestProposalUpdate' | 'rejectProposal';

interface QuoteDecisionDialogProps {
  mode: QuoteDecisionMode;
  step: WorkflowApprovalStep;
  submission: QuoteSubmission;
  /** No step after this one: the holder may pick another contractor (BR-S2-06). */
  isLastStep: boolean;
  onClose: () => void;
}

const TITLE: Record<QuoteDecisionMode, string> = {
  approveProposal: 'Duyệt tờ trình',
  requestProposalUpdate: 'Yêu cầu bổ sung tờ trình',
  rejectProposal: 'Từ chối tờ trình',
};

const SUCCESS: Record<QuoteDecisionMode, string> = {
  approveProposal: 'Đã duyệt tờ trình.',
  requestProposalUpdate: 'Đã yêu cầu bổ sung tờ trình.',
  rejectProposal: 'Đã từ chối tờ trình.',
};

const SHOWN = ['reason', 'selectedContractorIndex', 'selectionReason', 'boardMinutesAttachmentIds', 'signature'] as const;

/**
 * Decision of the current step holder (T07–T09). At a BQT-role step, approve and reject carry the board meeting
 * minutes and the holder's signature (BR-S2-05); at the last step, approve may choose another contractor with a
 * reason (BR-S2-06).
 */
export const QuoteDecisionDialog = ({ mode, step, submission, isLastStep, onClose }: QuoteDecisionDialogProps) => {
  const { detail } = useRecordContext();
  const { content } = submission;
  const command = useRecordCommand({ successMessage: SUCCESS[mode], onSuccess: onClose });
  const minutes = useAttachmentDraft();
  const [reason, setReason] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [selected, setSelected] = useState(content.proposedContractorIndex);
  const needsBoardEvidence = step.role === 'OWNERS_BOARD' && mode !== 'requestProposalUpdate';
  const canChooseContractor = mode === 'approveProposal' && isLastStep;
  const isChanged = canChooseContractor && selected !== content.proposedContractorIndex;
  const errors = command.fieldErrors;

  const confirm = () =>
    void command.run(mode, {
      submissionId: submission.id,
      ...(mode === 'approveProposal' ? {} : { reason: reason.trim() }),
      ...(needsBoardEvidence ? { boardMinutesAttachmentIds: minutes.ids, signature: signature ?? '' } : {}),
      ...(canChooseContractor ? { selectedContractorIndex: selected } : {}),
      ...(isChanged ? { selectionReason: reason.trim() } : {}),
    });

  return (
    <CommandDialog
      title={`${TITLE[mode]} · ${step.label}`}
      description={`Lần trình ${submission.attemptNo}/${LIMITS.MAX_SUBMISSION_ATTEMPTS}.`}
      confirmLabel={TITLE[mode]}
      confirmVariant={mode === 'rejectProposal' ? 'danger' : 'primary'}
      isPending={command.isPending}
      onConfirm={confirm}
      onClose={onClose}
      size="lg"
    >
      {canChooseContractor ? (
        <Field label="Nhà thầu thực hiện" htmlFor="decision-contractor" required error={errors.selectedContractorIndex}>
          <NativeSelect
            id="decision-contractor"
            value={String(selected)}
            onChange={(event) => setSelected(Number(event.target.value))}
          >
            {content.contractors.map((contractor, index) => (
              <option key={`contractor-${index}`} value={String(index)}>
                {contractor.name} · {formatVndString(content.contractorTotals[index]?.totalVnd)}
                {index === content.proposedContractorIndex ? ' (đề xuất)' : ''}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : null}
      {mode !== 'approveProposal' || isChanged ? (
        <Field
          label={isChanged ? 'Lý do chọn nhà thầu khác' : 'Lý do'}
          htmlFor="decision-reason"
          required
          hint="5–1000 ký tự."
          error={errors.reason ?? errors.selectionReason}
        >
          <Textarea id="decision-reason" rows={3} maxLength={LIMITS.REASON_MAX} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      ) : null}
      {needsBoardEvidence ? (
        <>
          <AttachmentField
            label="Biên bản họp BQT"
            recordId={detail.record.id}
            purpose="BOARD_MINUTES"
            items={minutes.items}
            onAdd={minutes.add}
            onRemove={minutes.remove}
            required
            error={errors.boardMinutesAttachmentIds}
          />
          <Field label="Chữ ký BQT" required error={errors.signature}>
            <SignaturePad onChange={setSignature} invalid={Boolean(errors.signature)} label="Chữ ký người giữ bước BQT" />
          </Field>
        </>
      ) : null}
      <FieldErrorList errors={errors} exclude={SHOWN} />
    </CommandDialog>
  );
};
