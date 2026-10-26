import { CheckCircle2, GitBranch, UserRound } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import { bindSelect } from '@/components/ui/bind-select';
import { Field } from '@/components/ui/field';
import { NativeSelect } from '@/components/ui/input';
import { approvalStepsFor } from '@/domain/actions';
import type { ApprovalStepKey, Role } from '@/domain/constants';
import type { FieldErrors } from '@/domain/errors';
import type { User } from '@/domain/types';
import { useReferenceData } from '@/hooks/useReferenceData';
import { activeConfirmersIn } from './record-form-schema';
import type { AssigneeField, RecordFormValues } from './record-form-schema';
import { ReadOnlyValue } from './ReadOnlyValue';

interface AssigneeFieldsProps {
  form: UseFormReturn<RecordFormValues>;
  users: User[];
  managerUserId: string;
  /** Assignees can be chosen only while creating or in DRAFT; afterwards use “Giao lại”. */
  editable: boolean;
  serverErrors: FieldErrors;
  approvalStepKeys?: readonly ApprovalStepKey[];
}

interface AssigneeFieldDef {
  field: AssigneeField;
  role: Role;
  label: string;
  placeholder: string;
}

/** Technical confirmation is separate; approval assignees come from the workflow rules. */
const FIELDS: readonly AssigneeFieldDef[] = [{ field: 'confirmationUserId', role: 'TECH_CONFIRMER', label: 'Người xác nhận hiện trạng', placeholder: 'Theo cấu hình tòa (tự động)' }];

const TECHNICAL_FIELD = FIELDS[0];

const optionLabel = (user: User): string => `${user.fullName} (${user.code})${user.active ? '' : ' – ngừng hoạt động'}`;

/** Manager, technical confirmer, and approval chain with clear visual grouping. */
export const AssigneeFields = ({ form, users, managerUserId, editable, serverErrors, approvalStepKeys }: AssigneeFieldsProps) => {
  const { userName } = useReferenceData();
  const { watch, formState } = form;
  const buildingId = watch('buildingId');
  const withCurrent = (list: User[], currentId: string) => {
    const current = users.find((user) => user.id === currentId);
    return current && !list.some((user) => user.id === currentId) ? [current, ...list] : list;
  };
  const hint = editable ? 'Chỉ hiển thị người còn hoạt động, đúng vai trò và cùng tòa.' : 'Hồ sơ đã gửi: đổi người bằng chức năng “Giao lại” ở trang chi tiết.';
  const renderField = (def: AssigneeFieldDef) => {
    const candidates = activeConfirmersIn(users, buildingId);
    const id = `rf-${def.field}`;
    return (
      <Field key={def.field} label={def.label} htmlFor={id} error={formState.errors[def.field]?.message ?? serverErrors[def.field]}>
        {editable ? (
          <NativeSelect id={id} {...bindSelect(form, def.field)}>
            <option value="">{def.placeholder}</option>
            {withCurrent(candidates, watch(def.field)).map((user) => (
              <option key={user.id} value={user.id}>
                {optionLabel(user)}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <ReadOnlyValue>{userName(watch(def.field))}</ReadOnlyValue>
        )}
      </Field>
    );
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface-2/65 p-3.5 sm:p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><UserRound className="size-4.5" aria-hidden /></span>
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink">BQL quản lý hồ sơ</p><p className="mt-0.5 text-xs text-ink-2">Người tạo hồ sơ và đầu mối theo dõi xử lý.</p></div>
            <span className="rounded-full bg-surface-3 px-2 py-1 text-2xs font-semibold text-ink-2">Tự động</span>
          </div>
          <div className="mt-3"><ReadOnlyValue>{userName(managerUserId)}</ReadOnlyValue></div>
        </div>

        <div className="rounded-xl border border-line bg-surface-2/35 p-3.5 sm:p-4">
          <div className="mb-3 flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-good-soft text-good"><CheckCircle2 className="size-4.5" aria-hidden /></span>
            <div className="min-w-0"><p className="text-sm font-semibold text-ink">Xác nhận kỹ thuật</p><p className="mt-0.5 text-xs text-ink-2">Người kiểm tra hiện trạng trước khi hồ sơ bước vào phê duyệt; mặc định theo cấu hình tòa.</p></div>
          </div>
          {renderField(TECHNICAL_FIELD)}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface-2/35 p-3.5 sm:p-4">
        <div className="mb-3 flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warn-soft text-warn"><GitBranch className="size-4.5" aria-hidden /></span>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink">Workflow phê duyệt</p><p className="mt-0.5 text-xs text-ink-2">Người duyệt và thứ tự được lấy tự động từ cấu hình workflow của tòa nhà.</p></div>
          <span className="hidden rounded-full bg-surface-3 px-2 py-1 text-2xs font-semibold text-ink-2 sm:inline-flex">Tự động</span>
        </div>
        <p className="mb-3 text-xs text-ink-3">{hint}</p>
        <div className="rounded-lg border border-dashed border-line-2 bg-surface px-3 py-2.5 text-sm text-ink-2">
          {approvalStepKeys && approvalStepKeys.length > 0 ? (
            <span>Chuỗi áp dụng: {approvalStepsFor(approvalStepKeys).map((step) => step.label).join(' → ')}</span>
          ) : (
            <span>Chuỗi áp dụng sẽ được xác định theo tòa nhà sau khi lưu hồ sơ.</span>
          )}
        </div>
      </div>
    </div>
  );
};
