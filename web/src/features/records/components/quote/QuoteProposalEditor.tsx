import { useState } from 'react';
import { ActionButton } from '@/components/common/ActionButton';
import { Notice } from '@/components/common/Notice';
import { SignaturePad } from '@/components/common/SignaturePad';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { REPAIR_ACTIONS, approvalStepsFor } from '@/domain/actions';
import { LIMITS } from '@/domain/constants';
import { BUDGET_SOURCE_LABEL, PROPOSAL_TYPE_LABEL, QUOTE_LIMITS, type BudgetSource, type ProposalType } from '@/domain/quote-proposal';
import type { QuoteProposalHistory } from '@/domain/quote-proposal';
import { useKnownFiles } from '../../hooks/useKnownFiles';
import { useQuoteForm } from '../../hooks/useQuoteForm';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { useRepairAction } from '../../hooks/useRepairAction';
import { useRecordContext } from '../../record-context';
import { withPrecondition } from '../../record-utils';
import { isDocsOverdue } from '../list/RecordFlags';
import { AttachmentField } from '../shared/AttachmentField';
import { FieldErrorList } from '../shared/FieldErrorList';
import { LateReasonField } from '../emergency/LateReasonField';
import { QuoteContractorFiles } from './QuoteContractorFiles';
import { QuoteTableEditor } from './QuoteTableEditor';

const SHOWN = [
  'lateReason',
  'recipient',
  'preparedByName',
  'proposalType',
  'budgetSource',
  'requestContent',
  'assessment',
  'desiredApprovalDate',
  'items',
  'contractors',
  'shortfallReason',
  'proposedContractorIndex',
  'incidentAttachmentIds',
  'signature',
] as const;

const QUOTE_FIELD = /^(items|contractors)\.(\d+)\./;

/**
 * Errors without their own message under a field: table cells (only outlined in the table) get their row or
 * contractor in front, quotation files are shown next to each contractor, anything else (e.g. `approvalStepKeys.1`)
 * as sent.
 */
const listedErrors = (errors: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(errors)
      .filter(([field]) => !field.endsWith('.quotationAttachmentIds'))
      .map(([field, message]) => {
        const match = QUOTE_FIELD.exec(field);
        if (!match) return [field, message];
        const owner = match[1] === 'items' ? 'Hạng mục' : 'Nhà thầu';
        return [field, `${owner} ${Number(match[2]) + 1}: ${message}`];
      }),
  );

/** Content the editor starts from: the saved draft, else the last submission (a resubmission edits it). */
const editorSource = (proposal: QuoteProposalHistory) => proposal.draft ?? proposal.submissions.at(-1)?.content ?? null;

/**
 * D5-TT proposal editor (T04–T06): header fields, quotation table, contractor files, incident minutes and the
 * submitter's signature. Totals are previews; the server computes the submitted amounts.
 */
export const QuoteProposalEditor = ({ proposal }: { proposal: QuoteProposalHistory }) => {
  const { detail } = useRecordContext();
  const { record } = detail;
  const save = useRepairAction('saveProposalDraft');
  const isFirst = proposal.submissions.length === 0;
  const submitAction = isFirst ? 'submitProposal' : 'resubmitProposal';
  const submit = useRepairAction(submitAction);
  const form = useQuoteForm(editorSource(proposal));
  const files = useKnownFiles(detail.attachments);
  const [signature, setSignature] = useState<string | null>(null);
  const [lateReason, setLateReason] = useState('');
  // B06-S1 BR-E-05: the server says the emergency documents are overdue; only the first submission is measured.
  const lateEmergency = isFirst && isDocsOverdue(record) ? record.emergency : undefined;
  const firstStep = approvalStepsFor(record.approvalStepKeys, record.workflowApprovalSteps)[0]?.label ?? 'bước đầu';
  const saveCommand = useRecordCommand({ successMessage: 'Đã lưu tờ trình nháp.' });
  const submitCommand = useRecordCommand({ successMessage: `Đã trình duyệt. Bước đầu: ${firstStep}.` });
  if (!save.relevant) return null;

  const { values } = form;
  const errors = { ...saveCommand.fieldErrors, ...submitCommand.fieldErrors };
  const isReadOnly = !save.state.allowed;
  const attemptNo = proposal.submissions.length + 1;
  const isShort = values.contractors.length < QUOTE_LIMITS.CONTRACTORS_EXPECTED;

  return (
    <Card>
      <CardHeader
        title="Tờ trình đang soạn"
        description={`Theo mẫu D5-TT. Lần trình tiếp theo: ${attemptNo}/${LIMITS.MAX_SUBMISSION_ATTEMPTS}.`}
      />
      <CardBody className="space-y-4">
        {attemptNo === LIMITS.MAX_SUBMISSION_ATTEMPTS ? (
          <Notice tone="warning" title="Đây sẽ là lần trình cuối cùng (3/3)">
            Ở lần trình thứ 3 người duyệt chỉ được Duyệt hoặc Từ chối; bị từ chối thì hồ sơ chuyển sang{' '}
            {record.emergency ? '“Không được duyệt hậu kiểm”' : '“Chưa xử lý”'}.
          </Notice>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Kính gửi" htmlFor="quote-recipient" hint="Bỏ trống: “Ban quản trị tòa …”." error={errors.recipient}>
            <Input id="quote-recipient" value={values.recipient} disabled={isReadOnly} onChange={(event) => form.set.recipient(event.target.value)} />
          </Field>
          <Field label="Người lập" htmlFor="quote-prepared" hint="Bỏ trống: người trình." error={errors.preparedByName}>
            <Input id="quote-prepared" value={values.preparedByName} disabled={isReadOnly} onChange={(event) => form.set.preparedByName(event.target.value)} />
          </Field>
          <Field label="Loại tờ trình" htmlFor="quote-type" required error={errors.proposalType}>
            <NativeSelect
              id="quote-type"
              value={values.proposalType}
              disabled={isReadOnly}
              onChange={(event) => form.set.proposalType(event.target.value as ProposalType | '')}
            >
              <option value="">Chọn loại</option>
              {Object.entries(PROPOSAL_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Ngân sách" htmlFor="quote-budget" required error={errors.budgetSource}>
            <NativeSelect
              id="quote-budget"
              value={values.budgetSource}
              disabled={isReadOnly}
              onChange={(event) => form.set.budgetSource(event.target.value as BudgetSource | '')}
            >
              <option value="">Chọn ngân sách</option>
              {Object.entries(BUDGET_SOURCE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field label="Nội dung xin phê duyệt" htmlFor="quote-request" required hint={`${QUOTE_LIMITS.TEXT_MIN}–${QUOTE_LIMITS.TEXT_MAX} ký tự.`} error={errors.requestContent}>
          <Textarea id="quote-request" rows={3} maxLength={QUOTE_LIMITS.TEXT_MAX} value={values.requestContent} disabled={isReadOnly} onChange={(event) => form.set.requestContent(event.target.value)} />
        </Field>
        <Field label="Đề xuất và đánh giá" htmlFor="quote-assessment" required hint={`${QUOTE_LIMITS.TEXT_MIN}–${QUOTE_LIMITS.TEXT_MAX} ký tự.`} error={errors.assessment}>
          <Textarea id="quote-assessment" rows={3} maxLength={QUOTE_LIMITS.TEXT_MAX} value={values.assessment} disabled={isReadOnly} onChange={(event) => form.set.assessment(event.target.value)} />
        </Field>
        <Field label="Hạn mong muốn phê duyệt" htmlFor="quote-due" error={errors.desiredApprovalDate}>
          <Input id="quote-due" type="date" className="max-w-48" value={values.desiredApprovalDate} disabled={isReadOnly} onChange={(event) => form.set.desiredApprovalDate(event.target.value)} />
        </Field>
        <Field label="Bảng báo giá" required error={errors.items ?? errors.contractors}>
          <QuoteTableEditor form={form} errors={errors} disabled={isReadOnly} />
        </Field>
        <QuoteContractorFiles form={form} recordId={record.id} errors={errors} disabled={isReadOnly} pick={files.pick} remember={files.remember} />
        {isShort ? (
          <Field label="Lý do không đủ 3 báo giá" htmlFor="quote-shortfall" required hint="10–1000 ký tự." error={errors.shortfallReason}>
            <Textarea id="quote-shortfall" rows={2} maxLength={QUOTE_LIMITS.SHORTFALL_MAX} value={values.shortfallReason} disabled={isReadOnly} onChange={(event) => form.set.shortfallReason(event.target.value)} />
          </Field>
        ) : null}
        <AttachmentField
          label="Biên bản ghi nhận sự việc"
          recordId={record.id}
          purpose="INCIDENT_MINUTES"
          items={files.pick(values.incidentAttachmentIds)}
          required
          disabled={isReadOnly}
          error={errors.incidentAttachmentIds}
          onAdd={(rows) => {
            files.remember(rows);
            form.set.incidentAttachmentIds([...values.incidentAttachmentIds, ...rows.map((row) => row.id)]);
          }}
          onRemove={(id) => form.set.incidentAttachmentIds(values.incidentAttachmentIds.filter((item) => item !== id))}
        />
        {lateEmergency ? <LateReasonField emergency={lateEmergency} value={lateReason} error={errors.lateReason} disabled={isReadOnly} onChange={setLateReason} /> : null}
        <Field label="Chữ ký người trình" required hint="Bắt buộc khi trình; mỗi lần trình ký lại." error={errors.signature}>
          <SignaturePad onChange={setSignature} disabled={isReadOnly} invalid={Boolean(errors.signature)} label="Chữ ký người trình tờ trình" />
        </Field>
        <FieldErrorList errors={listedErrors(errors)} exclude={SHOWN} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <ActionButton state={save.state} variant="secondary" isLoading={saveCommand.isPending} onClick={() => void saveCommand.run('saveProposalDraft', form.payload)}>
            {REPAIR_ACTIONS.saveProposalDraft.label}
          </ActionButton>
          <ActionButton
            state={withPrecondition(submit.state, Boolean(signature), 'Cần ký tên trước khi trình.')}
            isLoading={submitCommand.isPending}
            onClick={() => void submitCommand.run(submitAction, { ...form.payload, signature, ...(lateEmergency ? { lateReason: lateReason.trim() } : {}) })}
          >
            {REPAIR_ACTIONS[submitAction].label} (lần {attemptNo})
          </ActionButton>
        </div>
      </CardBody>
    </Card>
  );
};
