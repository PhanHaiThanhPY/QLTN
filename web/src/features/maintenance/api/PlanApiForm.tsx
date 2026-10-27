import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Notice } from '@/components/common/Notice';
import { Button } from '@/components/ui/button';
import { bindSelect } from '@/components/ui/bind-select';
import { Field } from '@/components/ui/field';
import { FormSection } from '@/components/ui/form-layout';
import { Input, NativeSelect } from '@/components/ui/input';
import { LIMITS } from '@/domain/constants';
import type { MaintenanceItem, User } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { useOnline } from '@/hooks/useOnline';
import type { ApiPlanDetail } from '@/services/maintenance-plans-api';
import { todayVn } from '@/services/runtime';
import { ChecklistTemplateEditor } from '../components/ChecklistTemplateEditor';
import { userOptionLabel } from '../utils/maintenance-ui';
import { buildPlanApiSchema, toPlanApiDefaults, toPlanApiPayload } from './plan-api-form-schema';
import type { PlanApiFormValues } from './plan-api-form-schema';
import { eligiblePerformers, eligibleReviewers, SCHEDULE_LIMIT } from './plan-api-ui';
import { PlanApiFormAside } from './PlanApiFormAside';

interface PlanApiFormProps {
  /** Undefined when creating. */
  detail?: ApiPlanDetail;
  /** Items the viewer may plan for (active, in scope). */
  items: MaintenanceItem[];
  users: User[];
  presetItemId?: string;
}

const UNIT_OPTIONS = [
  ['WEEK', 'tuần'],
  ['MONTH', 'tháng'],
] as const;

/** Create or edit a plan (ui-brief §2.2); after activation the item and the schedule stay locked. */
export const PlanApiForm = ({ detail, items, users, presetItemId }: PlanApiFormProps) => {
  const navigate = useNavigate();
  const online = useOnline();
  const today = todayVn();
  const scheduleLocked = Boolean(detail && detail.plan.status !== 'DRAFT');
  const schema = useMemo(() => buildPlanApiSchema(today, scheduleLocked), [today, scheduleLocked]);
  const defaults = useMemo(() => toPlanApiDefaults(detail, today, presetItemId), [detail, today, presetItemId]);
  const form = useForm<PlanApiFormValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const { register, handleSubmit, setValue, control, formState } = form;
  const errors = formState.errors;
  const command = useCommand();
  const server = command.fieldErrors;
  const [itemId, unit, every, startDate, performerUserId] = useWatch({
    control,
    name: ['itemId', 'unit', 'every', 'startDate', 'performerUserId'],
  });
  const item = items.find((row) => row.id === itemId) ?? (detail ? { ...detail.item, buildingId: detail.plan.buildingId } : undefined);
  const performers = item ? eligiblePerformers(users, item, item.buildingId) : [];
  const reviewers = item ? eligibleReviewers(users, item, item.buildingId, performerUserId) : [];

  const handleItemChange = (next: string) => {
    setValue('itemId', next, { shouldValidate: formState.isSubmitted });
    setValue('performerUserId', '');
    setValue('reviewerUserId', '');
  };

  const onSubmit = async (values: PlanApiFormValues) => {
    const payload = toPlanApiPayload(values, scheduleLocked);
    const result = await command.execute(
      detail
        ? { subjectType: 'MAINTENANCE_PLAN', subjectId: detail.plan.id, expectedVersion: detail.plan.version, action: 'updateMaintenancePlan', payload }
        : { subjectType: 'MAINTENANCE_PLAN', action: 'createMaintenancePlan', payload },
    );
    if (!result?.subjectId) return;
    toast.success(detail ? 'Đã lưu kế hoạch.' : 'Đã tạo kế hoạch nháp. Kích hoạt để hệ thống bắt đầu sinh lượt.');
    navigate(`/maintenance/plans/${result.subjectId}`);
  };

  return (
    <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="grid grid-cols-1 gap-4 lg:grid-cols-3" noValidate>
      <div className="space-y-4 lg:col-span-2">
        {scheduleLocked ? (
          <Notice tone="info" title="Kế hoạch đã kích hoạt">
            Không đổi thiết bị, chu kỳ và ngày bắt đầu ở đây — dùng “Đổi chu kỳ” ở trang kế hoạch. Thay đổi tên, danh mục kiểm, người và nhà thầu
            áp dụng cho các lượt chưa bắt đầu.
          </Notice>
        ) : null}
        {online ? null : <Notice tone="warning">Đang mất kết nối — chưa lưu được thay đổi.</Notice>}
        <FormSection title="Thông tin kế hoạch">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Thiết bị"
              htmlFor="plan-item"
              required
              error={errors.itemId?.message ?? server.itemId}
              hint={scheduleLocked ? 'Không đổi thiết bị sau khi kích hoạt.' : undefined}
            >
              <NativeSelect id="plan-item" value={itemId} disabled={scheduleLocked} onChange={(event) => handleItemChange(event.target.value)}>
                <option value="">— Chọn thiết bị —</option>
                {detail && !items.some((row) => row.id === detail.item.id) ? (
                  <option value={detail.item.id}>
                    {detail.item.code} – {detail.item.name}
                  </option>
                ) : null}
                {items.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.code} – {row.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Tên" htmlFor="plan-name" required error={errors.name?.message ?? server.name}>
              <Input id="plan-name" maxLength={LIMITS.TITLE_MAX} placeholder="VD: Kiểm tra bơm B01 hằng tháng" {...register('name')} />
            </Field>
            <Field
              label="Chu kỳ"
              htmlFor="plan-every"
              required
              error={errors.every?.message ?? server.every}
              hint={scheduleLocked ? 'Dùng “Đổi chu kỳ” để thay đổi.' : `Tuần: 1–${SCHEDULE_LIMIT.WEEK}, tháng: 1–${SCHEDULE_LIMIT.MONTH}.`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-2">Mỗi</span>
                <Input
                  id="plan-every"
                  type="number"
                  min={1}
                  max={SCHEDULE_LIMIT[unit]}
                  className="w-20"
                  disabled={scheduleLocked}
                  {...register('every', { valueAsNumber: true })}
                />
                <NativeSelect aria-label="Đơn vị chu kỳ" className="w-28" disabled={scheduleLocked} {...bindSelect(form, 'unit')}>
                  {UNIT_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </Field>
            <Field
              label="Ngày bắt đầu"
              htmlFor="plan-start"
              required
              error={errors.startDate?.message ?? server.startDate}
              hint="Ngày của lượt đầu tiên."
            >
              <Input id="plan-start" type="date" min={scheduleLocked ? undefined : today} disabled={scheduleLocked} {...register('startDate')} />
            </Field>
            <Field
              label="Người thực hiện"
              htmlFor="plan-performer"
              required
              error={errors.performerUserId?.message ?? server.performerUserId}
              hint={item ? 'KT hoặc BQL của vị trí thiết bị.' : 'Chọn thiết bị trước.'}
            >
              <NativeSelect id="plan-performer" disabled={!item} {...bindSelect(form, 'performerUserId')}>
                <option value="">— Chọn người thực hiện —</option>
                {performers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {userOptionLabel(user)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              label="Người xác nhận"
              htmlFor="plan-reviewer"
              required
              error={errors.reviewerUserId?.message ?? server.reviewerUserId}
              hint={item ? 'KT khác người thực hiện.' : 'Chọn thiết bị trước.'}
            >
              <NativeSelect id="plan-reviewer" disabled={!item} {...bindSelect(form, 'reviewerUserId')}>
                <option value="">— Chọn người xác nhận —</option>
                {reviewers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {userOptionLabel(user)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Nhà thầu (tùy chọn)" htmlFor="plan-contractor" error={errors.contractorName?.message ?? server.contractorName}>
              <Input id="plan-contractor" maxLength={LIMITS.CONTRACTOR_NAME_MAX} placeholder="Tên nhà thầu thực hiện" {...register('contractorName')} />
            </Field>
          </div>
        </FormSection>
        <FormSection title="Danh mục kiểm" description="Mỗi lượt giữ bản sao danh mục lúc sinh. Cần ít nhất 1 mục bắt buộc.">
          <ChecklistTemplateEditor control={control} register={register} errors={errors} serverErrors={server} serverListField="checklist" showPhoto />
        </FormSection>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => navigate(detail ? `/maintenance/plans/${detail.plan.id}` : '/maintenance/plans')}>
            Hủy
          </Button>
          <Button type="submit" isLoading={command.isPending} disabled={!online}>
            {detail ? 'Lưu thay đổi' : 'Tạo kế hoạch nháp'}
          </Button>
        </div>
      </div>
      <PlanApiFormAside unit={unit} every={every} startDate={startDate} scheduleLocked={scheduleLocked} />
    </form>
  );
};
