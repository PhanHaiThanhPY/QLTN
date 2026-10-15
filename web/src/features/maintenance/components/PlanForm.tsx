import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Notice } from '@/components/common/Notice';
import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-layout';
import { bindSelect } from '@/components/ui/bind-select';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { FREQUENCY_LABEL, LIMITS } from '@/domain/constants';
import type { Frequency } from '@/domain/constants';
import { currentScheduleVersion } from '@/domain/schedule';
import type { MaintenancePlan } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { useReferenceData } from '@/hooks/useReferenceData';
import { todayVn } from '@/services/runtime';
import { activeUsersInRole, userOptionLabel } from '../utils/maintenance-ui';
import { ChecklistTemplateEditor } from './ChecklistTemplateEditor';
import { PlanFormAside } from './PlanFormAside';
import { EMPTY_CHECKLIST_ROW, buildPlanSchema } from './plan-form-schema';
import type { PlanFormValues } from './plan-form-schema';

const FREQUENCY_OPTIONS = Object.entries(FREQUENCY_LABEL) as [Frequency, string][];

const toDefaults = (plan: MaintenancePlan | undefined, today: string): PlanFormValues => {
  if (!plan) {
    return {
      itemId: '',
      title: '',
      frequency: 'MONTHLY',
      anchorDate: today,
      checklist: [{ ...EMPTY_CHECKLIST_ROW }],
      confirmationUserId: '',
      contractorName: '',
    };
  }
  const version = currentScheduleVersion(plan);
  return {
    itemId: plan.itemId,
    title: plan.title,
    frequency: version.frequency,
    anchorDate: version.anchorDate,
    checklist: plan.checklistTemplate.map((row) => ({ ...row })),
    confirmationUserId: plan.confirmationUserId,
    contractorName: plan.contractorName ?? '',
  };
};

/** Create (plan undefined) or edit form; ACTIVE/PAUSED plans keep frequency and anchor locked. */
export const PlanForm = ({ plan }: { plan?: MaintenancePlan }) => {
  const navigate = useNavigate();
  const { data } = useReferenceData();
  const today = todayVn();
  const scheduleLocked = Boolean(plan && plan.status !== 'DRAFT');
  const schema = useMemo(() => buildPlanSchema(today, scheduleLocked), [today, scheduleLocked]);
  const defaults = useMemo(() => toDefaults(plan, today), [plan, today]);
  const command = useCommand();
  const form = useForm<PlanFormValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const { register, handleSubmit, watch, setValue, control, formState } = form;
  const errors = formState.errors;
  const server = command.fieldErrors;

  const itemId = watch('itemId');
  const selectableItems = (data?.items ?? []).filter((item) => item.active || item.id === plan?.itemId);
  const buildingId = (data?.items ?? []).find((item) => item.id === itemId)?.buildingId;
  const confirmers = activeUsersInRole(data?.users, 'TECH_CONFIRMER', buildingId);

  const handleItemChange = (nextItemId: string) => {
    setValue('itemId', nextItemId, { shouldValidate: formState.isSubmitted });
    setValue('confirmationUserId', '');
  };

  const onSubmit = async (values: PlanFormValues) => {
    const shared = {
      title: values.title,
      checklistTemplate: values.checklist.map((row) => ({ id: row.id, label: row.label, required: row.required })),
      confirmationUserId: values.confirmationUserId,
      contractorName: values.contractorName.trim(),
    };
    const schedule = scheduleLocked ? {} : { frequency: values.frequency, anchorDate: values.anchorDate };
    if (!plan) {
      const result = await command.execute({
        subjectType: 'MAINTENANCE_PLAN',
        action: 'createMaintenancePlan',
        payload: { itemId: values.itemId, ...shared, ...schedule },
      });
      if (!result?.subjectId) return;
      toast.success(`Đã tạo kế hoạch nháp ${String(result.data?.code ?? '')}. Kích hoạt để bắt đầu sinh lịch.`);
      navigate(`/maintenance/plans/${result.subjectId}`);
      return;
    }
    const result = await command.execute({
      subjectType: 'MAINTENANCE_PLAN',
      subjectId: plan.id,
      expectedVersion: plan.version,
      action: 'updateMaintenancePlan',
      payload: { ...shared, ...schedule },
    });
    if (!result) return;
    toast.success('Đã lưu kế hoạch.');
    navigate(`/maintenance/plans/${plan.id}`);
  };

  return (
    <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="grid grid-cols-1 gap-4 lg:grid-cols-3" noValidate>
      <div className="space-y-4 lg:col-span-2">
        {scheduleLocked ? (
          <Notice tone="info" title="Kế hoạch đã kích hoạt">
            Không đổi chu kỳ và ngày gốc ở đây — dùng “Đổi chu kỳ” ở trang chi tiết để lập phiên bản lịch mới. Thay đổi checklist, người xác
            nhận và nhà thầu chỉ áp dụng cho các lượt sinh sau khi lưu; lượt đã sinh giữ nguyên.
          </Notice>
        ) : null}
        <FormSection title="Thông tin kế hoạch">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Hạng mục bảo trì" htmlFor="plan-item" required error={errors.itemId?.message ?? server.itemId} hint={plan ? 'Không đổi hạng mục của kế hoạch đã tạo.' : undefined}>
              <NativeSelect id="plan-item" value={itemId} disabled={Boolean(plan)} onChange={(event) => handleItemChange(event.target.value)}>
                <option value="">— Chọn hạng mục —</option>
                {selectableItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} – {item.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Tên kế hoạch" htmlFor="plan-title" required error={errors.title?.message ?? server.title}>
              <Input id="plan-title" maxLength={120} placeholder="VD: Bảo trì hệ thống thang máy tháng 10" {...register('title')} />
            </Field>
            <Field
              label="Chu kỳ"
              htmlFor="plan-frequency"
              required
              error={errors.frequency?.message ?? server.frequency}
              hint={scheduleLocked ? 'Dùng “Đổi chu kỳ” để thay đổi.' : 'Tính theo ngày gốc, không theo ngày hoàn thành lượt trước.'}
            >
              {scheduleLocked ? (
                <Input id="plan-frequency" value={FREQUENCY_LABEL[defaults.frequency]} readOnly disabled />
              ) : (
                <NativeSelect id="plan-frequency" {...bindSelect(form, 'frequency')}>
                  {FREQUENCY_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field
              label="Ngày gốc"
              htmlFor="plan-anchor"
              required
              error={errors.anchorDate?.message ?? server.anchorDate}
              hint={scheduleLocked ? undefined : 'Không trước hôm nay. Ngày 29–31 sẽ lấy ngày cuối tháng khi tháng ngắn hơn.'}
            >
              {scheduleLocked ? (
                <Input id="plan-anchor" type="date" value={defaults.anchorDate} readOnly disabled />
              ) : (
                <Input id="plan-anchor" type="date" min={today} {...register('anchorDate')} />
              )}
            </Field>
            <Field
              label="Người xác nhận kỹ thuật"
              htmlFor="plan-confirmer"
              required
              error={errors.confirmationUserId?.message ?? server.confirmationUserId}
              hint={buildingId ? undefined : 'Chọn hạng mục trước.'}
            >
              <NativeSelect id="plan-confirmer" disabled={!buildingId} {...bindSelect(form, 'confirmationUserId')}>
                <option value="">— Chọn người xác nhận —</option>
                {confirmers.map((user) => (
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
        <FormSection title="Checklist mẫu" description="Mỗi lượt sinh ra lưu bản sao checklist tại thời điểm sinh. Cần ít nhất 1 mục bắt buộc.">
          <ChecklistTemplateEditor control={control} register={register} errors={errors} serverErrors={server} />
        </FormSection>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => navigate(plan ? `/maintenance/plans/${plan.id}` : '/maintenance/plans')}>
            Hủy
          </Button>
          <Button type="submit" isLoading={command.isPending}>
            {plan ? 'Lưu thay đổi' : 'Tạo kế hoạch nháp'}
          </Button>
        </div>
      </div>
      <PlanFormAside frequency={watch('frequency')} anchorDate={watch('anchorDate')} scheduleLocked={scheduleLocked} />
    </form>
  );
};
