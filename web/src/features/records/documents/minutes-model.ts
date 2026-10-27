import type { AcceptanceRound } from '@/domain/execution';
import type { RecordDetail } from '@/services/records-service';
import { memberHolderId, memberLabel } from '../components/execution/execution-utils';
import { DOTS, orDots, vnDateParts, type PrintNames, type PrintSignature } from './print-format';

/** The three representatives the form names, in its order (§3.2). */
const FORM_MEMBERS = [
  { stepKey: 'MANAGER', label: 'Đại diện Ban quản lý', column: 'Đại diện BQL' },
  { stepKey: 'BOARD', label: 'Đại diện Ban quản trị', column: 'Đại diện BQT' },
  { stepKey: 'TECH', label: 'Đại diện Tư vấn Kỹ thuật (nếu có)', column: 'Đại diện TVKT' },
] as const;

export interface MinutesColumn {
  label: string;
  signature: PrintSignature | null;
}

export interface MinutesPrintModel {
  title: string;
  isComplete: boolean;
  /** "Hôm nay, vào lúc … giờ …, ngày … tháng … năm …, tại: …". */
  openingLine: string;
  representatives: Array<{ label: string; name: string }>;
  otherMembers: string;
  content: string;
  outcome: 'PASSED' | 'FAILED' | null;
  notes: string[];
  /** BQL, BQT, TVKT as in the form, any custom ACCEPTANCE step, then "Khác" always empty (B7Q-04). */
  columns: MinutesColumn[];
}

/** §3.2: the fields of `BIÊN BẢN NGHIỆM THU.docx` filled from one acceptance round. */
export const buildMinutesModel = (detail: RecordDetail, round: AcceptanceRound, names: PrintNames): MinutesPrintModel => {
  const record = detail.record;
  const decisionOf = (stepKey: string) => round.decisions.find((decision) => decision.stepKey === stepKey);
  const nameOf = (stepKey: string): string => {
    if (!round.memberStepKeys.includes(stepKey)) return DOTS;
    return orDots(names.person(decisionOf(stepKey)?.actorId ?? memberHolderId(record, stepKey)));
  };
  const signatureOf = (stepKey: string): PrintSignature | null => {
    const decision = decisionOf(stepKey);
    return decision?.signatureDataUrl
      ? { imageDataUrl: decision.signatureDataUrl, signerName: names.person(decision.actorId), signedAt: decision.createdAt }
      : null;
  };
  const at = vnDateParts(round.inspectedAt);
  const formKeys: readonly string[] = FORM_MEMBERS.map((member) => member.stepKey);
  const customKeys = round.memberStepKeys.filter((key) => !formKeys.includes(key));
  return {
    title: `Biên bản nghiệm thu lượt ${round.roundNo}`,
    isComplete: round.outcome !== 'PENDING',
    openingLine: `Hôm nay, vào lúc ${at.hour} giờ ${at.minute}, ngày ${at.day} tháng ${at.month} năm ${at.year}, tại: ${orDots(round.inspectionLocation)}`,
    representatives: FORM_MEMBERS.map((member) => ({ label: member.label, name: nameOf(member.stepKey) })),
    otherMembers: orDots(round.otherMembers),
    content: orDots(round.content),
    outcome: round.outcome === 'PENDING' ? null : round.outcome,
    notes: round.decisions
      .filter((decision) => decision.note?.trim())
      .map((decision) => `${memberLabel(record, decision.stepKey)} (${names.person(decision.actorId)}): ${decision.note?.trim() ?? ''}`),
    columns: [
      ...FORM_MEMBERS.map((member) => ({ label: member.column, signature: signatureOf(member.stepKey) })),
      ...customKeys.map((key) => ({ label: memberLabel(record, key), signature: signatureOf(key) })),
      { label: 'Khác', signature: null },
    ],
  };
};
