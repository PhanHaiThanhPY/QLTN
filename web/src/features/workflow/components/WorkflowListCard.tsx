import { ArrowRight, Pencil, Workflow } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, StatusPill } from '@/components/ui/badge';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { workflowStagesOf } from '@/domain/building-config';
import type { Building, BuildingConfig } from '@/domain/types';
import { formatDateTime } from '@/utils/date';

interface WorkflowListItem {
  building: Building;
  config: BuildingConfig;
}

interface WorkflowListCardProps {
  items: WorkflowListItem[];
  onOpen: (buildingId: string) => void;
}

const approvalCount = (config: BuildingConfig): number => {
  const keys = new Set(workflowStagesOf(config.workflowStages, config.approvalStepKeys).flatMap((stage) => stage.approvalStepKeys));
  return keys.size;
};

const stageCount = (config: BuildingConfig): number => workflowStagesOf(config.workflowStages, config.approvalStepKeys).filter((stage) => stage.enabled).length;

const WorkflowMobileItem = ({ item, onOpen }: { item: WorkflowListItem; onOpen: (buildingId: string) => void }) => (
  <article className="rounded-lg border border-line p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Workflow className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink">{item.config.workflowName ?? 'Quy trình sửa chữa và bảo trì'}</h3>
          <p className="mt-0.5 truncate text-xs text-ink-2">{item.building.code} · {item.building.name}</p>
        </div>
      </div>
      <StatusPill tone={item.config.version > 0 ? 'good' : 'neutral'}>{item.config.version > 0 ? 'Đang áp dụng' : 'Chưa cấu hình'}</StatusPill>
    </div>
    <p className="mt-3 text-xs text-ink-2">{stageCount(item.config)} giai đoạn · {approvalCount(item.config)} vai trò phê duyệt</p>
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
      <span className="text-2xs text-ink-3">Cập nhật {formatDateTime(item.config.updatedAt)}</span>
      <Button variant="ghost" size="sm" onClick={() => onOpen(item.building.id)}>
        Chỉnh sửa <ArrowRight aria-hidden />
      </Button>
    </div>
  </article>
);

/** Workflow catalog shown before entering the visual designer. */
export const WorkflowListCard = ({ items, onOpen }: WorkflowListCardProps) => (
  <Card>
    <CardHeader title="Danh sách workflow" description="Mỗi tòa nhà có một workflow riêng để quản lý các bước xử lý và phê duyệt hồ sơ." actions={<Badge tone="neutral">{items.length} workflow</Badge>} />
    <CardBody className="pt-0">
      <div className="space-y-3 md:hidden">
        {items.map((item) => <WorkflowMobileItem key={item.building.id} item={item} onOpen={onOpen} />)}
      </div>
      <Table className="min-w-[56rem]">
        <thead>
          <tr>
            <Th>Workflow</Th>
            <Th>Tòa nhà</Th>
            <Th>Giai đoạn</Th>
            <Th>Phê duyệt</Th>
            <Th>Trạng thái</Th>
            <Th>Cập nhật</Th>
            <Th className="w-32">Thao tác</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <Tr key={item.building.id}>
              <Td>
                <div className="flex min-w-52 items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><Workflow className="size-4" aria-hidden /></span>
                  <div className="min-w-0"><p className="truncate font-semibold text-ink">{item.config.workflowName ?? 'Quy trình sửa chữa và bảo trì'}</p><p className="mt-0.5 truncate text-xs text-ink-3">{item.config.workflowDescription ?? 'Quy trình xử lý hồ sơ theo cấu hình của tòa nhà.'}</p></div>
                </div>
              </Td>
              <Td><p className="font-medium text-ink">{item.building.code}</p><p className="text-xs text-ink-3">{item.building.name}</p></Td>
              <Td>{stageCount(item.config)} giai đoạn</Td>
              <Td>{approvalCount(item.config)} vai trò</Td>
              <Td><StatusPill tone={item.config.version > 0 ? 'good' : 'neutral'}>{item.config.version > 0 ? 'Đang áp dụng' : 'Chưa cấu hình'}</StatusPill></Td>
              <Td className="whitespace-nowrap text-xs text-ink-2">{formatDateTime(item.config.updatedAt)}</Td>
              <Td><Button variant="ghost" size="sm" onClick={() => onOpen(item.building.id)}><Pencil aria-hidden /> Sửa</Button></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </CardBody>
  </Card>
);
