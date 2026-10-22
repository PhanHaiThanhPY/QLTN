import { Info, Save, Settings2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import type { Building } from '@/domain/types';
import type { WorkflowScope } from '../workflow-designer-meta';

interface WorkflowInfoPanelProps {
  building: Building;
  name: string;
  description: string;
  scope: WorkflowScope;
  targetCount: number;
  disabled: boolean;
  saving: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onScopeChange: (value: WorkflowScope) => void;
  onCancel: () => void;
  onSave: () => void;
}

/** Step 1 of the designer: workflow name, description and scope. */
export const WorkflowInfoPanel = ({
  building,
  name,
  description,
  scope,
  targetCount,
  disabled,
  saving,
  onNameChange,
  onDescriptionChange,
  onScopeChange,
  onCancel,
  onSave,
}: WorkflowInfoPanelProps) => (
  <Card className="overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent"><Settings2 className="size-4" /></span>
        <div><h2 className="text-sm font-semibold text-ink">1. Thông tin workflow</h2><p className="text-2xs text-ink-3">Tên, phạm vi và trạng thái áp dụng</p></div>
      </div>
      <Badge tone="info">{building.code} · {building.name}</Badge>
    </div>
    <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[minmax(24rem,1.45fr)_minmax(18rem,0.85fr)]">
      <div className="space-y-3">
        <Field label="Tên workflow" htmlFor="workflow-name" required>
          <Input id="workflow-name" value={name} disabled={disabled} maxLength={100} placeholder="VD: Quy trình sửa chữa" onChange={(event) => onNameChange(event.target.value)} />
        </Field>
        <Field label="Mô tả" htmlFor="workflow-description" hint={`${description.length}/300`}>
          <Textarea id="workflow-description" rows={2} value={description} disabled={disabled} maxLength={300} placeholder="Mục đích và phạm vi áp dụng" onChange={(event) => onDescriptionChange(event.target.value)} />
        </Field>
      </div>
      <Field label="Phạm vi áp dụng" htmlFor="workflow-scope" hint={scope === 'all' ? `${targetCount} tòa nhà sẽ được cập nhật` : 'Chỉ cập nhật tòa nhà đang chọn'}>
        <NativeSelect id="workflow-scope" value={scope} disabled={disabled} onChange={(event) => onScopeChange(event.target.value as WorkflowScope)}>
          <option value="current">{building.code} · {building.name}</option>
          <option value="all">Tất cả tòa nhà</option>
        </NativeSelect>
      </Field>
    </div>
    <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-line bg-surface-2/95 px-4 py-2.5 shadow-[0_-8px_20px_-18px_rgb(7_26_48_/_0.6)] backdrop-blur sm:px-5">
      <p className="flex items-start gap-1.5 text-xs text-ink-2"><Info className="mt-0.5 size-3.5 shrink-0 text-info" aria-hidden /><span>Thay đổi chỉ áp dụng cho hồ sơ tạo sau khi lưu.</span></p>
      <div className="flex gap-2"><Button variant="outline" disabled={disabled || saving} onClick={onCancel}><X /> Hủy</Button><Button disabled={disabled || saving || !name.trim()} isLoading={saving} onClick={onSave}><Save /> Lưu workflow</Button></div>
    </div>
  </Card>
);
