import { useState } from 'react';
import { useNavigate } from 'react-router';
import { MoneyInput } from '@/components/common/MoneyInput';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { TERM_MAX_DAYS, TERM_MIN_DAYS } from '@/domain/deposit';
import type { Attachment } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { useOnline } from '@/hooks/useOnline';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listBanks, type InvitationDetail } from '@/services/deposit-api';
import { digitsOf, groupDigits } from '@/features/fund/fund-input';
import { fromVnLocalInput, toVnLocalInput } from '@/features/exploitation/exploitation-ui';
import { DepositFileField } from './DepositFileField';

interface InvitationFormDialogProps {
  /** Editing a draft (every field) or a sent invitation (amount, term and deadline locked; banks only added). */
  detail?: InvitationDetail;
  onClose: () => void;
}

/** "Lập thư mời" / "Sửa" (SPEC T-S1 BR-T1-03, BR-T1-04, D-T1-4). */
export const InvitationFormDialog = ({ detail, onClose }: InvitationFormDialogProps) => {
  const navigate = useNavigate();
  const online = useOnline();
  const { data } = useReferenceData();
  const banks = useServiceQuery(['deposit', 'banks', 'all'], () => listBanks(true));
  const command = useCommand({ successMessage: detail ? 'Đã lưu thư mời.' : 'Đã soạn thư mời nháp.' });
  const invitation = detail?.invitation;
  const sent = invitation?.status === 'OPEN';
  const buildings = (data?.buildings ?? []).filter((building) => data?.viewer?.buildingIds.includes(building.id));
  const [buildingId, setBuildingId] = useState(invitation?.buildingId ?? buildings[0]?.id ?? '');
  const [amount, setAmount] = useState(groupDigits(invitation?.amountVnd));
  const [term, setTerm] = useState(String(invitation?.termDays ?? 90));
  const [deadline, setDeadline] = useState(toVnLocalInput(invitation?.deadlineAt));
  const [expected, setExpected] = useState(invitation?.expectedDepositOn ?? '');
  const [conditions, setConditions] = useState(invitation?.conditions ?? '');
  const [inviteeIds, setInviteeIds] = useState<string[]>(invitation?.inviteeIds ?? []);
  const [letter, setLetter] = useState<Attachment | null>(invitation?.letterAttachmentId ? (detail?.files[invitation.letterAttachmentId] ?? null) : null);
  const errors = command.fieldErrors;
  const locked = new Set(sent ? (invitation?.inviteeIds ?? []) : []);
  const choices = (banks.data ?? []).filter((bank) => bank.active || inviteeIds.includes(bank.id));
  const termDays = Number(term);
  const termError = Number.isInteger(termDays) && termDays >= TERM_MIN_DAYS && termDays <= TERM_MAX_DAYS ? undefined : `Kỳ hạn từ ${TERM_MIN_DAYS} đến 3.650 ngày.`;
  const ready = Boolean(digitsOf(amount)) && !termError && Boolean(buildingId);
  const toggle = (id: string) => setInviteeIds(inviteeIds.includes(id) ? inviteeIds.filter((value) => value !== id) : [...inviteeIds, id]);
  const submit = async () => {
    const payload = {
      amountVnd: digitsOf(amount),
      termDays,
      deadlineAt: fromVnLocalInput(deadline),
      expectedDepositOn: expected || null,
      conditions: conditions.trim() || null,
      letterAttachmentId: letter?.id ?? null,
      inviteeIds,
    };
    const result = await command.execute(
      invitation
        ? { subjectType: 'DEPOSIT_INVITATION', subjectId: invitation.id, expectedVersion: invitation.version, action: 'updateDepositInvitation', payload }
        : { subjectType: 'DEPOSIT_INVITATION', action: 'createDepositInvitation', payload: { ...payload, buildingId } },
    );
    if (!result) return;
    onClose();
    if (!invitation && result.subjectId) navigate(`/deposits/invitations/${result.subjectId}`);
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={invitation ? `Sửa ${invitation.code}` : 'Lập thư mời chào lãi'}
      description={sent ? 'Thư đã gửi: không đổi số tiền, kỳ hạn; đổi hạn bằng "Gia hạn"; chỉ thêm ngân hàng.' : 'Thư nháp; tệp thư mời tải sau khi lưu.'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} disabled={!online || !ready} onClick={() => void submit()}>
            Lưu
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Quỹ bảo trì của tòa" htmlFor="mc-building" required error={errors.buildingId} hint={invitation ? 'Không đổi sau khi tạo.' : undefined}>
          <NativeSelect id="mc-building" value={buildingId} disabled={Boolean(invitation)} onChange={(event) => setBuildingId(event.target.value)}>
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Số tiền mời gửi (VND)" htmlFor="mc-amount" required error={errors.amountVnd}>
          <MoneyInput id="mc-amount" value={amount} onChange={setAmount} disabled={sent} invalid={Boolean(errors.amountVnd)} />
        </Field>
        <Field label="Kỳ hạn (ngày)" htmlFor="mc-term" required error={errors.termDays ?? (term ? termError : undefined)}>
          <Input id="mc-term" inputMode="numeric" value={term} disabled={sent} onChange={(event) => setTerm(event.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Hạn phản hồi (giờ Việt Nam)" htmlFor="mc-deadline" error={errors.deadlineAt} hint="Cần có khi ghi nhận gửi.">
          <Input id="mc-deadline" type="datetime-local" value={deadline} disabled={sent} onChange={(event) => setDeadline(event.target.value)} />
        </Field>
        <Field label="Ngày dự kiến gửi tiền" htmlFor="mc-expected" error={errors.expectedDepositOn}>
          <Input id="mc-expected" type="date" value={expected} onChange={(event) => setExpected(event.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Ghi chú điều kiện" htmlFor="mc-conditions" error={errors.conditions}>
            <Textarea id="mc-conditions" rows={2} maxLength={2000} value={conditions} onChange={(event) => setConditions(event.target.value)} />
          </Field>
        </div>
        {invitation ? (
          <div className="sm:col-span-2">
            <DepositFileField invitationId={invitation.id} purpose="DEPOSIT_INVITATION_LETTER" label="Tệp thư mời" file={letter} onChange={setLetter} error={errors.letterAttachmentId} />
          </div>
        ) : null}
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-semibold text-ink">Ngân hàng được mời</legend>
          {choices.length === 0 ? <p className="text-sm text-ink-2">Chưa có ngân hàng nào. Thêm ở “Ngân hàng”.</p> : null}
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {choices.map((bank) => (
              <li key={bank.id}>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" className="h-4 w-4 accent-accent" checked={inviteeIds.includes(bank.id)} disabled={locked.has(bank.id)} onChange={() => toggle(bank.id)} />
                  {bank.name}
                  {bank.branch ? <span className="text-ink-3">· {bank.branch}</span> : null}
                </label>
              </li>
            ))}
          </ul>
          {errors.inviteeIds ? <p className="mt-1 text-xs text-crit" role="alert">{errors.inviteeIds}</p> : null}
        </fieldset>
      </div>
    </Dialog>
  );
};
