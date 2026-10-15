import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { LIMITS, PRIORITY_LABEL } from '@/domain/constants';
import type { Priority } from '@/domain/constants';
import { useCommand } from '@/hooks/useCommand';
import { useReferenceData } from '@/hooks/useReferenceData';
import type { OccurrenceDetail } from '@/services/maintenance-service';
import { activeUsersInRole, userOptionLabel } from '../../utils/maintenance-ui';

const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABEL) as [Priority, string][];

interface CreateRepairDialogProps {
  detail: OccurrenceDetail;
  onClose: () => void;
}

const issueSummary = (detail: OccurrenceDetail): string =>
  detail.occurrence.checklist
    .filter((entry) => entry.result === 'ISSUE')
    .map((entry) => `${entry.label}: ${entry.note ?? ''}`.trim())
    .join('\n');

/** createRepairFromMaintenance: DRAFT repair record linked both ways; photos copied from this occurrence (spec 8.3). */
export const CreateRepairDialog = ({ detail, onClose }: CreateRepairDialogProps) => {
  const navigate = useNavigate();
  const { data } = useReferenceData();
  const { occurrence, item, attachments } = detail;
  const buildingId = occurrence.buildingId;
  const confirmers = activeUsersInRole(data?.users, 'TECH_CONFIRMER', buildingId);
  // Inactive locations stay valid on old data but are not offered for new records.
  const locations = (data?.locations ?? []).filter((row) => row.buildingId === buildingId && (row.active !== false || row.id === item?.locationId));
  const images = attachments.filter((row) => row.mimeType.startsWith('image/'));
  const issuePhotoIds = new Set(occurrence.checklist.filter((entry) => entry.result === 'ISSUE').flatMap((entry) => entry.attachmentIds));

  const [title, setTitle] = useState(item ? `Sửa chữa ${item.name}` : '');
  const [description, setDescription] = useState(() => issueSummary(detail));
  const [locationId, setLocationId] = useState(item?.locationId ?? '');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [confirmationUserId, setConfirmer] = useState(confirmers.some((user) => user.id === occurrence.confirmationUserId) ? occurrence.confirmationUserId : '');
  const [photoIds, setPhotoIds] = useState<string[]>(() => images.filter((row) => issuePhotoIds.has(row.id)).map((row) => row.id));
  const command = useCommand();
  const errors = command.fieldErrors;
  const descriptionError =
    description.trim().length > 0 && description.trim().length < LIMITS.DESCRIPTION_MIN ? `Mô tả cần tối thiểu ${LIMITS.DESCRIPTION_MIN} ký tự.` : undefined;

  const togglePhoto = (id: string) => setPhotoIds((prev) => (prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id]));

  const handleSubmit = async () => {
    const result = await command.execute({
      subjectType: 'MAINTENANCE_OCCURRENCE',
      subjectId: occurrence.id,
      expectedVersion: occurrence.version,
      action: 'createRepairFromMaintenance',
      payload: { title, description, locationId, priority, confirmationUserId, attachmentIds: photoIds },
    });
    if (!result?.subjectId) return;
    toast.success(`Đã tạo hồ sơ sửa chữa nháp ${String(result.data?.code ?? '')}.`);
    onClose();
    navigate(`/records/${result.subjectId}`);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={`Tạo hồ sơ sửa chữa từ ${occurrence.code}`}
      description="Hồ sơ mới ở trạng thái Nháp, sao chép tòa nhà, vị trí, hạng mục, mô tả và ảnh; lượt bảo trì không đổi trạng thái."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} onClick={() => void handleSubmit()}>
            Tạo hồ sơ sửa chữa
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tên hồ sơ" htmlFor="cr-title" required error={errors.title} className="sm:col-span-2">
          <Input id="cr-title" maxLength={LIMITS.TITLE_MAX} placeholder="VD: Rò rỉ nước trần hành lang tầng 5" value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Mô tả hư hỏng" htmlFor="cr-description" required error={descriptionError ?? errors.description} className="sm:col-span-2">
          <Textarea id="cr-description" rows={4} maxLength={LIMITS.DESCRIPTION_MAX} placeholder="Mô tả vị trí, hiện trạng và mức độ hư hỏng..." value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Field label="Vị trí" htmlFor="cr-location" required error={errors.locationId}>
          <NativeSelect id="cr-location" value={locationId} onChange={(event) => setLocationId(event.target.value)}>
            <option value="">— Chọn vị trí —</option>
            {locations.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} · Tầng {row.floor}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Mức ưu tiên" htmlFor="cr-priority" required error={errors.priority}>
          <NativeSelect id="cr-priority" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
            {PRIORITY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Người xác nhận sửa chữa" htmlFor="cr-confirmer" required error={errors.confirmationUserId}>
          <NativeSelect id="cr-confirmer" value={confirmationUserId} onChange={(event) => setConfirmer(event.target.value)}>
            <option value="">— Chọn người —</option>
            {confirmers.map((user) => (
              <option key={user.id} value={user.id}>
                {userOptionLabel(user)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Người duyệt tờ trình" hint="Có thể đổi ở trang sửa hồ sơ khi còn là nháp.">
          <p className="py-2 text-sm text-ink-2">Người duyệt và thứ tự sẽ lấy theo workflow đã cấu hình của tòa nhà.</p>
        </Field>
        <Field label="Ảnh hư hỏng (từ lượt bảo trì)" required error={errors.attachmentIds} className="sm:col-span-2">
          {images.length === 0 ? (
            <p className="text-sm text-ink-2">Lượt chưa có ảnh. Tải ảnh ở tab “Checklist & kết quả” trước.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {images.map((image) => (
                <li key={image.id}>
                  <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface-2">
                    <input type="checkbox" className="h-4 w-4 accent-accent" checked={photoIds.includes(image.id)} onChange={() => togglePhoto(image.id)} />
                    <span className="truncate">{image.fileName}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Field>
      </div>
    </Dialog>
  );
};
