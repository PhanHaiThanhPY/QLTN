import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Notice } from '@/components/common/Notice';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { LIMITS, PRIORITY_LABEL } from '@/domain/constants';
import type { Priority } from '@/domain/constants';
import { suggestIncidentPriority } from '@/domain/operational-guidance';
import { useCommand } from '@/hooks/useCommand';
import { useReferenceData } from '@/hooks/useReferenceData';

interface QuickIncidentDialogProps {
  onClose: () => void;
}

const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABEL) as [Priority, string][];

/** Creates a repair draft quickly, leaving photos and the approval chain for the full form. */
export const QuickIncidentDialog = ({ onClose }: QuickIncidentDialogProps) => {
  const navigate = useNavigate();
  const { data, isLoading } = useReferenceData();
  const command = useCommand();
  const defaultBuildingId = data?.viewer.buildingIds.length === 1 ? data.viewer.buildingIds[0] : data?.buildings[0]?.id ?? '';
  const [buildingId, setBuildingId] = useState(defaultBuildingId);
  const [locationId, setLocationId] = useState('');
  const [maintenanceItemId, setMaintenanceItemId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [localError, setLocalError] = useState<string | undefined>();

  useEffect(() => {
    if (!buildingId && defaultBuildingId) setBuildingId(defaultBuildingId);
  }, [buildingId, defaultBuildingId]);

  const locations = useMemo(() => (data?.locations ?? []).filter((row) => row.buildingId === buildingId && row.active !== false), [buildingId, data?.locations]);
  const items = useMemo(() => (data?.items ?? []).filter((row) => row.buildingId === buildingId && row.active), [buildingId, data?.items]);
  const guidance = suggestIncidentPriority(title, description);

  const changeBuilding = (value: string) => {
    setBuildingId(value);
    setLocationId('');
    setMaintenanceItemId('');
  };

  const applySuggestion = () => {
    if (guidance) setPriority(guidance.priority);
  };

  const handleSubmit = async () => {
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    if (!buildingId || !locationId || cleanTitle.length < LIMITS.TITLE_MIN || cleanDescription.length < LIMITS.DESCRIPTION_MIN) {
      setLocalError(`Hãy chọn tòa nhà, vị trí và nhập tên hồ sơ tối thiểu ${LIMITS.TITLE_MIN} ký tự cùng mô tả tối thiểu ${LIMITS.DESCRIPTION_MIN} ký tự.`);
      return;
    }
    setLocalError(undefined);
    const result = await command.execute({
      subjectType: 'REPAIR_RECORD',
      action: 'createRecord',
      payload: { buildingId, locationId, maintenanceItemId: maintenanceItemId || undefined, title: cleanTitle, description: cleanDescription, priority },
    });
    if (!result?.subjectId) return;
    toast.success('Đã ghi nhận sự cố ở trạng thái Nháp.');
    onClose();
    navigate(`/records/${result.subjectId}/edit`);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title="Ghi nhận sự cố nhanh"
      description="Tạo nháp trong vài bước, sau đó bổ sung ảnh hiện trường và gửi xác nhận khi đủ thông tin."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button isLoading={command.isPending} disabled={isLoading} onClick={() => void handleSubmit()}>Tạo hồ sơ nháp</Button>
        </>
      }
    >
      <div className="space-y-4">
        {localError ? <Notice tone="warning">{localError}</Notice> : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tòa nhà" htmlFor="quick-building" required>
            <NativeSelect id="quick-building" value={buildingId} onChange={(event) => changeBuilding(event.target.value)}>
              <option value="">— Chọn tòa nhà —</option>
              {(data?.buildings ?? []).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Vị trí" htmlFor="quick-location" required error={command.fieldErrors.locationId}>
            <NativeSelect id="quick-location" value={locationId} onChange={(event) => setLocationId(event.target.value)}>
              <option value="">— Chọn vị trí —</option>
              {locations.map((row) => <option key={row.id} value={row.id}>{row.name} · Tầng {row.floor}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Thiết bị / hạng mục" htmlFor="quick-item" hint="Có thể bổ sung sau nếu chưa xác định." className="sm:col-span-2">
            <NativeSelect id="quick-item" value={maintenanceItemId} onChange={(event) => setMaintenanceItemId(event.target.value)}>
              <option value="">— Chưa xác định —</option>
              {items.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Tên sự cố" htmlFor="quick-title" required error={command.fieldErrors.title} className="sm:col-span-2">
            <Input id="quick-title" maxLength={LIMITS.TITLE_MAX} placeholder="VD: Rò rỉ nước tại WC tầng 5" value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field label="Mô tả hiện trạng" htmlFor="quick-description" required error={command.fieldErrors.description} className="sm:col-span-2">
            <Textarea id="quick-description" rows={4} maxLength={LIMITS.DESCRIPTION_MAX} placeholder="Mô tả vị trí, hiện trạng, mức độ ảnh hưởng và thời điểm phát hiện..." value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
          <Field label="Mức ưu tiên" htmlFor="quick-priority" required>
            <NativeSelect id="quick-priority" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              {PRIORITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </NativeSelect>
          </Field>
        </div>
        {guidance ? (
          <Notice tone="info" title="Gợi ý vận hành theo rule">
            {guidance.reason} {guidance.priority !== priority ? <button type="button" className="ml-1 font-semibold text-accent hover:underline" onClick={applySuggestion}>Áp dụng mức {PRIORITY_LABEL[guidance.priority]}</button> : <span className="ml-1 font-semibold">Đang chọn mức phù hợp.</span>}
          </Notice>
        ) : null}
        <p className="text-xs text-ink-3">Hồ sơ được tạo ở trạng thái Nháp. Bạn sẽ chuyển sang màn hình đầy đủ để thêm ảnh hiện trường, người xác nhận và gửi vào workflow.</p>
      </div>
    </Dialog>
  );
};
