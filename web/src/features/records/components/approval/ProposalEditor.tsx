import { useState } from 'react';
import { ActionButton } from '@/components/common/ActionButton';
import { Notice } from '@/components/common/Notice';
import { SignaturePad } from '@/components/common/SignaturePad';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { REPAIR_ACTIONS } from '@/domain/actions';
import { approvalStepsFor } from '@/domain/actions';
import { LIMITS } from '@/domain/constants';
import { buildProposalGuidance } from '@/domain/operational-guidance';
import { now } from '@/services/runtime';
import { formatVndInput, parseVndInput } from '@/utils/money';
import { useAttachmentDraft } from '../../hooks/useAttachmentDraft';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { useRepairAction } from '../../hooks/useRepairAction';
import { useRecordContext } from '../../record-context';
import { pickAttachments, withPrecondition } from '../../record-utils';
import { AttachmentField } from '../shared/AttachmentField';
import { FieldErrorList } from '../shared/FieldErrorList';
import { MoneyInput } from '@/components/common/MoneyInput';
import { RecordAlerts } from '../shared/RecordAlerts';

const SHOWN = ['proposal', 'contractorName', 'amountVnd', 'attachmentIds', 'signature', 'lateReason'] as const;

/** Working proposal (ProposalDraft): plan, contractor name, price and PROPOSAL files; the submitter signs when submitting. */
export const ProposalEditor = () => {
  const { detail } = useRecordContext();
  const { record, proposalDraft } = detail;
  const save = useRepairAction('saveProposalDraft');
  const isFirst = detail.submissions.length === 0;
  const submitAction = isFirst ? 'submitProposal' : 'resubmitProposal';
  const submit = useRepairAction(submitAction);
  const [proposal, setProposal] = useState(proposalDraft?.proposal ?? '');
  const [contractorName, setContractorName] = useState(proposalDraft?.contractorName ?? '');
  const [amount, setAmount] = useState(formatVndInput(proposalDraft?.amountVnd));
  const [signature, setSignature] = useState<string | null>(null);
  const [lateReason, setLateReason] = useState('');
  const files = useAttachmentDraft(pickAttachments(detail.attachments, proposalDraft?.attachmentIds ?? []));
  const saveCommand = useRecordCommand({ successMessage: 'Đã lưu tờ trình nháp.' });
  const firstApprovalLabel = approvalStepsFor(record.approvalStepKeys, record.workflowApprovalSteps)[0]?.label ?? 'bước đầu theo workflow';
  const submitCommand = useRecordCommand({ successMessage: isFirst ? `Đã trình duyệt. Bước đầu: ${firstApprovalLabel}.` : `Đã trình lại. Bước đầu: ${firstApprovalLabel}.` });
  if (!save.relevant) return null;

  const payload = {
    proposal: proposal.trim(),
    contractorName: contractorName.trim(),
    amountVnd: parseVndInput(amount),
    attachmentIds: files.ids,
  };
  const proposalGuidance = buildProposalGuidance({
    proposal,
    contractorName,
    amountVnd: payload.amountVnd,
    attachmentCount: files.items.length,
    priceAlertCount: detail.alerts.filter((alert) => alert.kind === 'PRICE' || alert.kind === 'EMERGENCY_OVER_LIMIT').length,
  });
  const attemptNo = detail.submissions.length + 1;
  const errors = { ...saveCommand.fieldErrors, ...submitCommand.fieldErrors };
  const isReadOnly = !save.state.allowed;
  const emergency = record.status === 'EMERGENCY_IN_PROGRESS' ? record.emergency : undefined;
  const isLate = Boolean(emergency && now().toISOString() > emergency.docsDueAt);

  return (
    <Card>
      <CardHeader
        title="Tờ trình đang soạn"
        description={`Bản làm việc riêng – chưa tạo lần trình. Lần trình tiếp theo: ${attemptNo}/${LIMITS.MAX_SUBMISSION_ATTEMPTS}.`}
      />
      <CardBody className="space-y-4">
        {attemptNo === LIMITS.MAX_SUBMISSION_ATTEMPTS ? (
          <Notice tone="warning" title="Đây sẽ là lần trình cuối cùng (3/3)">
            Ở lần trình thứ 3 người duyệt chỉ được Duyệt hoặc Từ chối; nếu bị từ chối ở bất kỳ bước nào, hồ sơ sẽ đóng.
          </Notice>
        ) : null}
        <Field
          label="Phương án / nội dung tờ trình"
          htmlFor="proposal-text"
          required
          hint={`Tối thiểu ${LIMITS.PROPOSAL_MIN} ký tự khi trình.`}
          error={errors.proposal}
        >
          <Textarea
            id="proposal-text"
            rows={5}
            maxLength={LIMITS.DESCRIPTION_MAX}
            placeholder="Mô tả đề xuất, phạm vi công việc và phương án thực hiện..."
            value={proposal}
            disabled={isReadOnly}
            onChange={(event) => setProposal(event.target.value)}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nhà thầu thực hiện" htmlFor="proposal-contractor" required error={errors.contractorName}>
            <Input
              id="proposal-contractor"
              placeholder="Ví dụ: Công ty TNHH Kỹ thuật ABC"
              maxLength={LIMITS.CONTRACTOR_NAME_MAX}
              value={contractorName}
              disabled={isReadOnly}
              aria-invalid={Boolean(errors.contractorName)}
              onChange={(event) => setContractorName(event.target.value)}
            />
          </Field>
          <Field label="Giá trị (VND)" htmlFor="proposal-amount" required error={errors.amountVnd}>
            <MoneyInput id="proposal-amount" value={amount} onChange={setAmount} disabled={isReadOnly} invalid={Boolean(errors.amountVnd)} />
          </Field>
        </div>
        <RecordAlerts alerts={detail.alerts} kinds={['WARRANTY', 'PRICE']} />
        <Notice tone={proposalGuidance.missing.length > 0 || proposalGuidance.warnings.length > 0 ? 'warning' : 'info'} title="Gợi ý vận hành · Kiểm tra tờ trình">
          {proposalGuidance.missing.length > 0 ? <p>Còn thiếu: {proposalGuidance.missing.join(', ')}.</p> : <p>Thông tin cơ bản đã đủ theo rule hiện tại.</p>}
          {proposalGuidance.warnings.length > 0 ? <p className="mt-1">{proposalGuidance.warnings.join(' ')}</p> : null}
          <p className="mt-1 text-xs">Tóm tắt: {proposalGuidance.summary}</p>
        </Notice>
        <AttachmentField
          label="Tài liệu tờ trình"
          recordId={record.id}
          purpose="PROPOSAL"
          items={files.items}
          onAdd={files.add}
          onRemove={files.remove}
          required
          disabled={isReadOnly}
          error={errors.attachmentIds}
        />
        <Field label="Chữ ký người trình" required hint="Bắt buộc khi trình; mỗi lần trình ký lại." error={errors.signature}>
          <SignaturePad onChange={setSignature} disabled={isReadOnly} invalid={Boolean(errors.signature)} label="Chữ ký người trình tờ trình" />
        </Field>
        {isLate ? (
          <Field label="Lý do bổ sung hồ sơ khẩn cấp trễ hạn" htmlFor="late-reason" required error={errors.lateReason}>
            <Textarea id="late-reason" rows={2} maxLength={LIMITS.REASON_MAX} placeholder="Giải thích lý do bổ sung hồ sơ trễ hạn..." value={lateReason} disabled={isReadOnly} onChange={(event) => setLateReason(event.target.value)} />
          </Field>
        ) : null}
        <FieldErrorList errors={errors} exclude={SHOWN} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <ActionButton
            state={save.state}
            variant="secondary"
            isLoading={saveCommand.isPending}
            onClick={() => void saveCommand.run('saveProposalDraft', payload)}
          >
            {REPAIR_ACTIONS.saveProposalDraft.label}
          </ActionButton>
          <ActionButton
            state={withPrecondition(submit.state, Boolean(signature), 'Cần ký tên trước khi trình.')}
            isLoading={submitCommand.isPending}
            onClick={() => void submitCommand.run(submitAction, { ...payload, signature, lateReason: isLate ? lateReason.trim() : undefined })}
          >
            {REPAIR_ACTIONS[submitAction].label} (lần {attemptNo})
          </ActionButton>
        </div>
      </CardBody>
    </Card>
  );
};
