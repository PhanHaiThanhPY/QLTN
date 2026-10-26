import { useState } from 'react';
import { Copy } from 'lucide-react';
import { MoneyInput } from '@/components/common/MoneyInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { CONFIG_DUE_KINDS, CONFIG_TEMPLATES, withProposalChain, workflowStagesOf } from '@/domain/building-config';
import type { Building, BuildingConfig } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { useReferenceData } from '@/hooks/useReferenceData';
import { formatDateTime } from '@/utils/date';
import { toConfigPayload, toDraft } from '../config-form';
import type { ConfigDraft } from '../config-form';
import { ApplyTemplateDialog } from './ApplyTemplateDialog';
import { ApprovalChainEditor } from './ApprovalChainEditor';

interface ConfigCardProps {
  building: Building;
  buildings: Building[];
  config: BuildingConfig;
  canEdit: boolean;
}

/** Per-building processing times, emergency limit and alert thresholds; changes apply to new records only. */
export const ConfigCard = ({ building, buildings, config, canEdit }: ConfigCardProps) => {
  const { userName } = useReferenceData();
  const [draft, setDraft] = useState<ConfigDraft>(() => toDraft(config));
  const [isApplying, setIsApplying] = useState(false);
  const command = useCommand({ successMessage: 'Đã lưu cấu hình tòa nhà.' });
  const errors = command.fieldErrors;
  const template = CONFIG_TEMPLATES.find((row) => row.key === config.templateKey);
  const set = (key: Exclude<keyof ConfigDraft, 'days'>, value: string) => setDraft((prev) => ({ ...prev, [key]: value }));
  const save = () =>
    void command.execute({
      subjectType: 'BUILDING',
      subjectId: building.id,
      expectedVersion: config.version,
      action: 'updateBuildingConfig',
      // The chain edited here is the PROPOSAL stage (BR-10), so the stages travel with it.
      payload: {
        ...toConfigPayload(draft, config.templateKey, false),
        workflowStages: withProposalChain(workflowStagesOf(config.workflowStages, config.approvalStepKeys), draft.approvalStepKeys),
      },
    });

  return (
    <Card>
      <CardHeader
        title="Cấu hình tòa nhà"
        description="Áp dụng cho hồ sơ tạo sau khi lưu; hồ sơ đang xử lý giữ cấu hình cũ."
        actions={template ? <Badge tone="info">Theo mẫu: {template.name}</Badge> : null}
      />
      <CardBody className="space-y-5">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-ink-2">Thời hạn xử lý (ngày)</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CONFIG_DUE_KINDS.map(({ kind, label }) => (
              <Field key={kind} label={label} htmlFor={`cfg-${kind}`} error={errors[`taskDueDays.${kind}`]}>
                <Input
                  id={`cfg-${kind}`}
                  inputMode="numeric"
                  placeholder="Số ngày"
                  value={draft.days[kind] ?? ''}
                  disabled={!canEdit}
                  onChange={(event) => setDraft((prev) => ({ ...prev, days: { ...prev.days, [kind]: event.target.value } }))}
                />
              </Field>
            ))}
          </div>
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-ink-2">Sửa chữa khẩn cấp</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Hạn mức được làm trước khi duyệt" htmlFor="cfg-limit" error={errors.emergencyLimitVnd}>
              <MoneyInput id="cfg-limit" value={draft.emergencyLimit} onChange={(value) => set('emergencyLimit', value)} disabled={!canEdit} />
            </Field>
            <Field label="Bổ sung hồ sơ trong (giờ)" htmlFor="cfg-hours" error={errors.emergencyDocHours}>
              <Input id="cfg-hours" inputMode="numeric" placeholder="Số giờ" value={draft.emergencyHours} disabled={!canEdit} onChange={(event) => set('emergencyHours', event.target.value)} />
            </Field>
          </div>
        </section>
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-ink-2">Workflow phê duyệt tờ trình</h3>
            <p className="mt-1 text-xs text-ink-3">Tự chọn vai trò, thêm hoặc bỏ bước và sắp xếp thứ tự. Chỉ hồ sơ tạo mới áp dụng cấu hình sau khi lưu.</p>
          </div>
          <ApprovalChainEditor
            value={draft.approvalStepKeys}
            disabled={!canEdit}
            onChange={(approvalStepKeys) => setDraft((prev) => ({ ...prev, approvalStepKeys }))}
          />
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-ink-2">Ngưỡng cảnh báo</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Mới sửa đã hỏng (ngày)" htmlFor="cfg-recent" error={errors.recentRepairDays}>
              <Input id="cfg-recent" inputMode="numeric" placeholder="Số ngày" value={draft.recentDays} disabled={!canEdit} onChange={(event) => set('recentDays', event.target.value)} />
            </Field>
            <Field label="Hỏng lặp lại (số hồ sơ / 12 tháng)" htmlFor="cfg-repeat" error={errors.repeatMinRecords}>
              <Input id="cfg-repeat" inputMode="numeric" placeholder="Số hồ sơ" value={draft.repeatMin} disabled={!canEdit} onChange={(event) => set('repeatMin', event.target.value)} />
            </Field>
            <Field label="Giá bất thường (lần trung bình)" htmlFor="cfg-ratio" error={errors.priceRatio}>
              <Input id="cfg-ratio" inputMode="decimal" placeholder="VD: 1.5" value={draft.priceRatio} disabled={!canEdit} onChange={(event) => set('priceRatio', event.target.value)} />
            </Field>
          </div>
        </section>
        <p className="text-xs text-ink-3">
          Phiên bản {config.version} · cập nhật {formatDateTime(config.updatedAt)} bởi {userName(config.updatedBy)}
        </p>
        {canEdit ? (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setIsApplying(true)}>
              <Copy className="h-4 w-4" />
              Áp dụng cấu hình mẫu
            </Button>
            <Button isLoading={command.isPending} onClick={save}>
              Lưu cấu hình
            </Button>
          </div>
        ) : null}
      </CardBody>
      {isApplying ? <ApplyTemplateDialog building={building} buildings={buildings} config={config} onClose={() => setIsApplying(false)} /> : null}
    </Card>
  );
};
