import { useState } from 'react';
import { Notice } from '@/components/common/Notice';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { NativeSelect } from '@/components/ui/input';
import { CONFIG_TEMPLATES, diffConfig, templateValues } from '@/domain/building-config';
import type { ConfigValues } from '@/domain/building-config';
import type { Building, BuildingConfig } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listBuildingConfigs } from '@/services/building-service';

interface ApplyTemplateDialogProps {
  building: Building;
  buildings: Building[];
  config: BuildingConfig;
  onClose: () => void;
}

const BUILDING_PREFIX = 'building:';

/** Copies a shared template or another building's settings, showing every change before applying. */
export const ApplyTemplateDialog = ({ building, buildings, config, onClose }: ApplyTemplateDialogProps) => {
  const [source, setSource] = useState(CONFIG_TEMPLATES[0].key);
  const configs = useServiceQuery(['buildings', 'configs'], listBuildingConfigs);
  const command = useCommand({ successMessage: 'Đã áp dụng cấu hình mẫu.', onSuccess: onClose });
  const others = buildings.filter((row) => row.id !== building.id);
  const sourceBuildingId = source.startsWith(BUILDING_PREFIX) ? source.slice(BUILDING_PREFIX.length) : undefined;
  const values: ConfigValues | undefined = sourceBuildingId
    ? configs.data?.find((row) => row.buildingId === sourceBuildingId)
    : templateValues(source);
  const changes = values ? diffConfig(config, values) : [];
  const description = CONFIG_TEMPLATES.find((row) => row.key === source)?.description;

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={`Áp dụng cấu hình mẫu cho ${building.name}`}
      description="Xem trước các thay đổi; cấu hình mới chỉ áp dụng cho hồ sơ tạo sau đó."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            isLoading={command.isPending}
            disabled={!values || changes.length === 0}
            onClick={() =>
              void command.execute({
                subjectType: 'BUILDING',
                subjectId: building.id,
                expectedVersion: config.version,
                action: 'applyConfigTemplate',
                payload: sourceBuildingId ? { sourceBuildingId } : { templateKey: source },
              })
            }
          >
            Áp dụng {changes.length > 0 ? `${changes.length} thay đổi` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Lấy cấu hình từ" htmlFor="tpl-source" hint={description}>
          <NativeSelect id="tpl-source" value={source} onChange={(event) => setSource(event.target.value)}>
            {CONFIG_TEMPLATES.map((row) => (
              <option key={row.key} value={row.key}>
                Mẫu: {row.name}
              </option>
            ))}
            {others.map((row) => (
              <option key={row.id} value={`${BUILDING_PREFIX}${row.id}`}>
                Sao chép từ {row.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {changes.length === 0 ? (
          <Notice title="Không có thay đổi">Cấu hình đang giống với nguồn đã chọn.</Notice>
        ) : (
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-2xs uppercase tracking-wide text-ink-3">
                <tr>
                  <th className="px-3 py-2 font-medium">Mục</th>
                  <th className="px-3 py-2 font-medium">Hiện tại</th>
                  <th className="px-3 py-2 font-medium">Sau khi áp dụng</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((row) => (
                  <tr key={row.label} className="border-t border-line">
                    <td className="px-3 py-2 text-ink-2">{row.label}</td>
                    <td className="px-3 py-2 text-ink-3 line-through">{row.from}</td>
                    <td className="px-3 py-2 font-medium text-ink">{row.to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Dialog>
  );
};
