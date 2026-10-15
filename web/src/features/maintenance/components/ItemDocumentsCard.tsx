import { AttachmentList } from '@/components/common/AttachmentList';
import { FileUploader } from '@/components/common/FileUploader';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { hasCapability } from '@/domain/permissions';
import type { Attachment, MaintenanceItem, User } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';

interface ItemDocumentsCardProps {
  item: MaintenanceItem;
  documents: Attachment[];
  viewer: User;
}

/** Manuals, warranty papers and contracts of an item; BQL of the building adds or removes them. */
export const ItemDocumentsCard = ({ item, documents, viewer }: ItemDocumentsCardProps) => {
  const command = useCommand({ successMessage: 'Đã cập nhật tài liệu thiết bị.' });
  const canEdit = item.active && hasCapability(viewer, 'MAINTENANCE_MANAGE') && viewer.buildingIds.includes(item.buildingId);
  const save = (documentIds: string[]) =>
    command.execute({
      subjectType: 'MAINTENANCE_ITEM',
      subjectId: item.id,
      expectedVersion: item.version,
      action: 'setItemDocuments',
      payload: { documentIds },
    });
  return (
    <Card>
      <CardHeader title="Tài liệu thiết bị" description="Hướng dẫn sử dụng, phiếu bảo hành, hợp đồng, biên bản kiểm định." />
      <CardBody className="space-y-3">
        <AttachmentList
          attachments={documents}
          emptyText="Chưa có tài liệu."
          onRemove={canEdit ? (id) => void save(item.documentIds.filter((row) => row !== id)) : undefined}
        />
        {canEdit ? (
          <FileUploader
            subjectType="MAINTENANCE_ITEM"
            subjectId={item.id}
            purpose="ITEM_DOCUMENT"
            label="Thêm tài liệu"
            disabled={command.isPending}
            onUploaded={(rows) => void save([...item.documentIds, ...rows.map((row) => row.id)])}
          />
        ) : null}
      </CardBody>
    </Card>
  );
};
