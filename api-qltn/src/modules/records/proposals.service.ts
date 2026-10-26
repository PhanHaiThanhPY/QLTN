import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { conflict, conflictWithReason, notFound } from '../../common/errors';
import { FieldErrors } from '../../common/validation/field-errors';
import type { WorkflowApprovalStep } from '../../domain/building-config';
import { AuditService } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { Attachment } from '../attachments/entities/attachment.entity';
import { Building } from '../buildings/entities/building.entity';
import { User } from '../users/entities/user.entity';
import type {
  ApproveProposalDto,
  ProposalReasonDto,
  SaveProposalDraftDto,
  SubmitProposalDto,
} from './dto/proposal.dto';
import { RepairProposalDecision, type DecisionOutcome } from './entities/repair-proposal-decision.entity';
import { RepairProposalSubmission } from './entities/repair-proposal-submission.entity';
import { RepairRecord } from './entities/repair-record.entity';
import { RepairSignature, type SignedDocumentType } from './entities/repair-signature.entity';
import { completeProposal, mergeProposalDraft, type ProposalInput } from './proposal-validation';
import type { ProposalDraft, SubmissionContent } from './proposal.types';
import { isActiveUserForApprovalStep, loadAssignmentContext } from './record-assignment';
import { loadRecordForAction, validateText } from './record-loader';
import { approvalStepOf, currentStepKeyOf, proposalChainStepsOf, stepHolderOf, waitingStatusOf } from './record-steps';
import { toRecordView, type RepairRecordView } from './record-view';
import { checkSignature, signatureDataUrl } from './signature';

/** DF-04: at most three submissions; the third may only be approved or rejected (BR-S2-03). */
const MAX_SUBMISSION_ATTEMPTS = 3;
const READY_FOR_CONSTRUCTION = 'READY_FOR_CONSTRUCTION';
const NEEDS_SUBMISSION_UPDATE = 'NEEDS_SUBMISSION_UPDATE';
const REJECTED_RESUBMITTABLE = 'REJECTED_RESUBMITTABLE';
const UNRESOLVED = 'UNRESOLVED';
const REASON_MIN = 5;
const REASON_MAX = 1000;

/** §4.1 default "Ban quản trị tòa «tên tòa»", without doubling the word when the name already starts with it. */
const recipientOf = (buildingName: string): string =>
  /^tòa\s/i.test(buildingName) ? `Ban quản trị ${buildingName}` : `Ban quản trị tòa ${buildingName}`.trim();

type SubmitAction = 'submitProposal' | 'resubmitProposal';
type DecisionAction = 'approveProposal' | 'requestProposalUpdate' | 'rejectProposal';

export interface ProposalDecisionView {
  id: string;
  stepKey: string;
  actorId: string;
  outcome: DecisionOutcome;
  reason: string | null;
  selectedContractorIndex: number | null;
  attachmentIds: string[];
  createdAt: Date;
}

export interface ProposalSignatureView {
  id: string;
  documentType: SignedDocumentType;
  documentId: string;
  signerId: string;
  imageDataUrl: string;
  createdAt: Date;
}

export interface ProposalSubmissionView {
  id: string;
  attemptNo: number;
  content: SubmissionContent;
  proposedAmountVnd: string;
  attachmentIds: string[];
  submittedBy: string;
  submittedAt: Date;
  decisions: ProposalDecisionView[];
  signatures: ProposalSignatureView[];
}

export interface ProposalHistoryView {
  draft: ProposalDraft | null;
  /** Oldest first; each one immutable (BR-S2-02). */
  submissions: ProposalSubmissionView[];
}

interface DecisionTarget {
  record: RepairRecord;
  submission: RepairProposalSubmission;
  step: WorkflowApprovalStep;
  fromStatus: string;
}

const toDecisionView = (row: RepairProposalDecision): ProposalDecisionView => ({
  id: row.id,
  stepKey: row.stepKey,
  actorId: row.actorId,
  outcome: row.outcome,
  reason: row.reason,
  selectedContractorIndex: row.selectedContractorIndex,
  attachmentIds: [...row.attachmentIds],
  createdAt: row.createdAt,
});

const toSignatureView = (row: RepairSignature): ProposalSignatureView => ({
  id: row.id,
  documentType: row.documentType,
  documentId: row.documentId,
  signerId: row.signerId,
  imageDataUrl: signatureDataUrl(row.content),
  createdAt: row.createdAt,
});

const inputOf = (dto: SaveProposalDraftDto): ProposalInput => {
  const { version: _version, ...fields } = dto;
  void _version;
  return fields;
};

/**
 * Proposal and approval chain of a repair record (SPEC B03–B09 v2 slice S2, T04–T09). Every action locks the
 * record, checks version and the shared action rules, and writes its rows plus audit in one transaction.
 */
@Injectable()
export class ProposalsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** T04: keeps the status; bumps the version so a stale tab cannot submit an outdated draft. */
  async saveDraft(actor: AuthenticatedUser, id: string, dto: SaveProposalDraftDto): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const record = await loadRecordForAction(manager, actor, id, dto.version, 'saveProposalDraft');
      record.proposalDraft = mergeProposalDraft(record.proposalDraft, inputOf(dto));
      await this.assertDraftFiles(manager, record, record.proposalDraft);
      return this.commit(manager, actor, record, 'saveProposalDraft', record.status);
    });
  }

  /** T05/T06: freezes the draft as attempt N and restarts the chain at its first step (BR-S2-01…04). */
  async submit(
    actor: AuthenticatedUser,
    id: string,
    action: SubmitAction,
    dto: SubmitProposalDto,
  ): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const record = await loadRecordForAction(manager, actor, id, dto.version, action);
      const { signature, ...draftFields } = dto;
      const previous = await manager.getRepository(RepairProposalSubmission).countBy({ recordId: record.id });
      if (previous >= MAX_SUBMISSION_ATTEMPTS) {
        throw conflictWithReason('max_submission_attempts', `Đã đạt tối đa ${MAX_SUBMISSION_ATTEMPTS} lần trình.`);
      }
      const draft = mergeProposalDraft(record.proposalDraft, inputOf(draftFields));
      record.proposalDraft = draft;
      const chain = proposalChainStepsOf(record);
      const content = completeProposal(
        draft,
        await this.defaultsOf(manager, record),
        stepHolderOf(record, chain.find((step) => step.role === 'TECH_CONSULTANT')?.key ?? '') ?? null,
      );
      const errors = new FieldErrors();
      await this.validateChainHolders(manager, errors, record, chain);
      await this.validateFiles(manager, errors, record, content);
      const signed = checkSignature(signature);
      if (!signed.ok) errors.add('signature', signed.message);
      const firstStep = chain[0];
      errors.when(!firstStep, 'approvalStepKeys', 'Hồ sơ chưa có bước duyệt tờ trình.');
      errors.throwIfAny();
      if (!signed.ok || !firstStep) return toRecordView(record);

      const proposed = content.contractorTotals[content.proposedContractorIndex];
      const submission = await manager.getRepository(RepairProposalSubmission).save(
        manager.getRepository(RepairProposalSubmission).create({
          recordId: record.id,
          attemptNo: previous + 1,
          content,
          proposedAmountVnd: proposed.totalVnd,
          attachmentIds: [
            ...content.incidentAttachmentIds,
            ...content.contractors.flatMap((contractor) => contractor.quotationAttachmentIds),
          ],
          submittedBy: actor.id,
        }),
      );
      await this.saveSignature(manager, record, actor, 'PROPOSAL', submission.id, signed.content);

      const fromStatus = record.status;
      record.status = waitingStatusOf(firstStep);
      record.currentApprovalStepKey = firstStep.key;
      record.currentSubmissionId = submission.id;
      return this.commit(manager, actor, record, action, fromStatus, `Lần trình ${submission.attemptNo}`);
    });
  }

  /** T07: next step, or after the last one the chosen contractor and amount (BR-S2-05…07). */
  async approve(actor: AuthenticatedUser, id: string, dto: ApproveProposalDto): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const target = await this.loadDecision(manager, actor, id, 'approveProposal', dto);
      const { record, submission, step } = target;
      const chain = proposalChainStepsOf(record);
      const stepIndex = chain.findIndex((candidate) => candidate.key === step.key);
      const next = stepIndex >= 0 ? chain[stepIndex + 1] : undefined;
      const content = submission.content;

      const errors = new FieldErrors();
      const selected = dto.selectedContractorIndex ?? content.proposedContractorIndex;
      const changed = selected !== content.proposedContractorIndex;
      if (dto.selectedContractorIndex !== undefined && next) {
        errors.add('selectedContractorIndex', 'Chỉ bước duyệt cuối mới chọn nhà thầu.');
      } else if (!Number.isInteger(selected) || selected < 0 || selected >= content.contractors.length) {
        errors.add('selectedContractorIndex', 'Nhà thầu được chọn không có trong bảng báo giá.');
      } else if (changed) {
        validateText(
          errors,
          'selectionReason',
          'Lý do chọn nhà thầu khác',
          dto.selectionReason,
          REASON_MIN,
          REASON_MAX,
        );
      }
      const boardEvidence = await this.boardEvidence(manager, errors, target, dto);
      errors.throwIfAny();

      const decision = await this.saveDecision(manager, actor, target, 'APPROVED', {
        reason: changed ? (dto.selectionReason ?? '').trim() : null,
        selectedContractorIndex: next ? null : selected,
        attachmentIds: boardEvidence?.attachmentIds ?? [],
      });
      if (boardEvidence) {
        await this.saveSignature(manager, record, actor, 'BOARD_DECISION', decision.id, boardEvidence.signature);
      }
      if (next) {
        record.status = waitingStatusOf(next);
        record.currentApprovalStepKey = next.key;
        return this.commit(manager, actor, record, 'approveProposal', target.fromStatus, step.label);
      }
      const contractor = content.contractors[selected];
      record.status = READY_FOR_CONSTRUCTION;
      record.currentApprovalStepKey = null;
      record.approvedSubmissionId = submission.id;
      record.approvedAmountVnd = content.contractorTotals[selected].totalVnd;
      record.executingContractorName = contractor.name;
      const reason = changed
        ? `${step.label}; chọn nhà thầu «${contractor.name}» thay nhà thầu đề xuất: ${(dto.selectionReason ?? '').trim()}`
        : step.label;
      return this.commit(manager, actor, record, 'approveProposal', target.fromStatus, reason);
    });
  }

  /** T08: back to the manager; refused on the last allowed attempt (`final_attempt_decide_only`). */
  async requestUpdate(actor: AuthenticatedUser, id: string, dto: ProposalReasonDto): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const target = await this.loadDecision(manager, actor, id, 'requestProposalUpdate', dto);
      if (target.submission.attemptNo >= MAX_SUBMISSION_ATTEMPTS) {
        throw conflictWithReason(
          'final_attempt_decide_only',
          `Đây là lần trình thứ ${MAX_SUBMISSION_ATTEMPTS}: chỉ được duyệt hoặc từ chối.`,
        );
      }
      const reason = this.requireReason(dto.reason);
      await this.saveDecision(manager, actor, target, 'NEEDS_UPDATE', { reason });
      target.record.status = NEEDS_SUBMISSION_UPDATE;
      target.record.currentApprovalStepKey = null;
      return this.commit(manager, actor, target.record, 'requestProposalUpdate', target.fromStatus, reason);
    });
  }

  /** T09: resubmittable, or `UNRESOLVED` on the last allowed attempt. */
  async reject(actor: AuthenticatedUser, id: string, dto: ProposalReasonDto): Promise<RepairRecordView> {
    return this.dataSource.transaction(async (manager) => {
      const target = await this.loadDecision(manager, actor, id, 'rejectProposal', dto);
      const errors = new FieldErrors();
      validateText(errors, 'reason', 'Lý do', dto.reason, REASON_MIN, REASON_MAX);
      const boardEvidence = await this.boardEvidence(manager, errors, target, dto);
      errors.throwIfAny();
      const reason = (dto.reason ?? '').trim();
      const decision = await this.saveDecision(manager, actor, target, 'REJECTED', {
        reason,
        attachmentIds: boardEvidence?.attachmentIds ?? [],
      });
      if (boardEvidence) {
        await this.saveSignature(manager, target.record, actor, 'BOARD_DECISION', decision.id, boardEvidence.signature);
      }
      const isLast = target.submission.attemptNo >= MAX_SUBMISSION_ATTEMPTS;
      target.record.status = isLast ? UNRESOLVED : REJECTED_RESUBMITTABLE;
      target.record.currentApprovalStepKey = null;
      return this.commit(manager, actor, target.record, 'rejectProposal', target.fromStatus, reason);
    });
  }

  /** Draft plus every submission with its decisions and signatures, for the detail screen. */
  async historyOf(record: RepairRecord): Promise<ProposalHistoryView> {
    const submissions = await this.dataSource
      .getRepository(RepairProposalSubmission)
      .find({ where: { recordId: record.id }, order: { attemptNo: 'ASC' } });
    if (submissions.length === 0) return { draft: record.proposalDraft, submissions: [] };
    const [decisions, signatures] = await Promise.all([
      this.dataSource
        .getRepository(RepairProposalDecision)
        .find({ where: { recordId: record.id }, order: { createdAt: 'ASC', id: 'ASC' } }),
      this.dataSource
        .getRepository(RepairSignature)
        .find({ where: { recordId: record.id }, order: { createdAt: 'ASC', id: 'ASC' } }),
    ]);
    return {
      draft: record.proposalDraft,
      submissions: submissions.map((submission) => {
        const ownDecisions = decisions.filter((row) => row.submissionId === submission.id);
        const documentIds = new Set([submission.id, ...ownDecisions.map((row) => row.id)]);
        return {
          id: submission.id,
          attemptNo: submission.attemptNo,
          content: submission.content,
          proposedAmountVnd: submission.proposedAmountVnd,
          attachmentIds: [...submission.attachmentIds],
          submittedBy: submission.submittedBy,
          submittedAt: submission.submittedAt,
          decisions: ownDecisions.map(toDecisionView),
          signatures: signatures.filter((row) => documentIds.has(row.documentId)).map(toSignatureView),
        };
      }),
    };
  }

  /**
   * Capability → status → step holder (shared rules), then the current submission: the submitter may not decide
   * it (409 `self_approval_denied`), and a stale `submissionId` answers 409 (BR-S2-07).
   */
  private async loadDecision(
    manager: EntityManager,
    actor: AuthenticatedUser,
    id: string,
    action: DecisionAction,
    dto: { version: number; submissionId?: string },
  ): Promise<DecisionTarget> {
    const record = await loadRecordForAction(manager, actor, id, dto.version, action);
    const key = currentStepKeyOf(record);
    const step = key ? approvalStepOf(record, key) : undefined;
    const submission = record.currentSubmissionId
      ? await manager.getRepository(RepairProposalSubmission).findOneBy({ id: record.currentSubmissionId })
      : null;
    if (!step || !submission) throw notFound('Không tìm thấy lần trình hiện hành.');
    if (submission.submittedBy === actor.id) {
      throw conflictWithReason('self_approval_denied', 'Người lập tờ trình không được tự quyết định lần trình này.');
    }
    if (dto.submissionId && dto.submissionId !== submission.id) {
      throw conflict('Lần trình đã thay đổi. Vui lòng tải lại.');
    }
    return { record, submission, step, fromStatus: record.status };
  }

  /**
   * BR-S2-05: approve and reject at a BQT-role step need board minutes uploaded for the current submission and the
   * holder's signature. Other steps carry neither.
   */
  private async boardEvidence(
    manager: EntityManager,
    errors: FieldErrors,
    target: DecisionTarget,
    dto: { signature?: string; boardMinutesAttachmentIds?: string[] },
  ): Promise<{ attachmentIds: string[]; signature: Buffer } | null> {
    if (target.step.role !== 'OWNERS_BOARD') return null;
    const ids = [...new Set(dto.boardMinutesAttachmentIds ?? [])];
    if (ids.length === 0) {
      errors.add('boardMinutesAttachmentIds', 'Cần biên bản họp BQT của lần trình này.');
    } else {
      const rows = await manager.getRepository(Attachment).findBy({ id: In(ids) });
      const valid = rows.filter(
        (row) =>
          row.subjectId === target.record.id &&
          row.purpose === 'BOARD_MINUTES' &&
          row.createdAt.getTime() >= target.submission.submittedAt.getTime(),
      );
      errors.when(
        valid.length !== ids.length,
        'boardMinutesAttachmentIds',
        'Biên bản họp BQT phải là tệp tải lên cho lần trình hiện hành của hồ sơ này.',
      );
    }
    const signed = checkSignature(dto.signature);
    if (!signed.ok) {
      errors.add('signature', signed.message);
      return null;
    }
    return { attachmentIds: ids, signature: signed.content };
  }

  /** BR-S2-04: each chain holder must still be active, in role and in scope; one error per step. */
  private async validateChainHolders(
    manager: EntityManager,
    errors: FieldErrors,
    record: RepairRecord,
    chain: readonly WorkflowApprovalStep[],
  ): Promise<void> {
    const assignment = await loadAssignmentContext(manager, record.buildingId);
    chain.forEach((step, index) => {
      const holder = stepHolderOf(record, step.key);
      errors.when(
        !isActiveUserForApprovalStep(assignment, holder, step, record.buildingId, record.locationId),
        `approvalStepKeys.${index}`,
        `Người xử lý bước «${step.label}» đã ngừng hoạt động hoặc không hợp lệ. Cần kiểm tra lại phân công.`,
      );
    });
  }

  /** Files must belong to this record with the purpose of their slot. */
  private async validateFiles(
    manager: EntityManager,
    errors: FieldErrors,
    record: RepairRecord,
    draft: ProposalDraft,
  ): Promise<void> {
    const slots: { field: string; ids: string[]; purpose: string }[] = [
      { field: 'incidentAttachmentIds', ids: draft.incidentAttachmentIds ?? [], purpose: 'INCIDENT_MINUTES' },
      ...(draft.contractors ?? []).map((contractor, index) => ({
        field: `contractors.${index}.quotationAttachmentIds`,
        ids: contractor.quotationAttachmentIds,
        purpose: 'QUOTATION',
      })),
    ];
    const allIds = [...new Set(slots.flatMap((slot) => slot.ids))];
    if (allIds.length === 0) return;
    const rows = await manager.getRepository(Attachment).findBy({ id: In(allIds) });
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const slot of slots) {
      const invalid = slot.ids.some((attachmentId) => {
        const row = byId.get(attachmentId);
        return !row || row.subjectId !== record.id || row.purpose !== slot.purpose;
      });
      errors.when(invalid, slot.field, 'Tệp đính kèm không hợp lệ hoặc không thuộc hồ sơ này.');
    }
  }

  private async assertDraftFiles(manager: EntityManager, record: RepairRecord, draft: ProposalDraft): Promise<void> {
    const errors = new FieldErrors();
    await this.validateFiles(manager, errors, record, draft);
    errors.throwIfAny();
  }

  private async defaultsOf(
    manager: EntityManager,
    record: RepairRecord,
  ): Promise<{ recipient: string; preparedByName: string }> {
    const [building, submitter] = await Promise.all([
      manager.getRepository(Building).findOneBy({ id: record.buildingId }),
      manager.getRepository(User).findOneBy({ id: record.managerUserId }),
    ]);
    return {
      recipient: recipientOf(building?.name ?? ''),
      preparedByName: submitter?.fullName ?? '',
    };
  }

  private requireReason(value: string | undefined): string {
    const errors = new FieldErrors();
    validateText(errors, 'reason', 'Lý do', value, REASON_MIN, REASON_MAX);
    errors.throwIfAny();
    return (value ?? '').trim();
  }

  private async saveDecision(
    manager: EntityManager,
    actor: AuthenticatedUser,
    target: DecisionTarget,
    outcome: DecisionOutcome,
    extra: { reason: string | null; selectedContractorIndex?: number | null; attachmentIds?: string[] },
  ): Promise<RepairProposalDecision> {
    const repo = manager.getRepository(RepairProposalDecision);
    return repo.save(
      repo.create({
        submissionId: target.submission.id,
        recordId: target.record.id,
        stepKey: target.step.key,
        actorId: actor.id,
        outcome,
        reason: extra.reason,
        selectedContractorIndex: extra.selectedContractorIndex ?? null,
        attachmentIds: extra.attachmentIds ?? [],
      }),
    );
  }

  private async saveSignature(
    manager: EntityManager,
    record: RepairRecord,
    actor: AuthenticatedUser,
    documentType: SignedDocumentType,
    documentId: string,
    content: Buffer,
  ): Promise<void> {
    const repo = manager.getRepository(RepairSignature);
    await repo.save(
      repo.create({
        recordId: record.id,
        documentType,
        documentId,
        signerId: actor.id,
        mimeType: 'image/png',
        content,
      }),
    );
  }

  private async commit(
    manager: EntityManager,
    actor: AuthenticatedUser,
    record: RepairRecord,
    action: string,
    fromStatus: string,
    reason?: string,
  ): Promise<RepairRecordView> {
    record.version += 1;
    const saved = await manager.getRepository(RepairRecord).save(record);
    await this.audit.record(manager, {
      subjectType: SUBJECT_TYPE.REPAIR_RECORD,
      subjectId: saved.id,
      buildingId: saved.buildingId,
      action,
      actorId: actor.id,
      entityVersion: saved.version,
      fromStatus,
      toStatus: saved.status,
      ...(reason ? { reason } : {}),
    });
    return toRecordView(saved);
  }
}
