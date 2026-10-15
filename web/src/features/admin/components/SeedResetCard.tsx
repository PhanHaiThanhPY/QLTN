import { useState } from 'react';
import { useNavigate } from 'react-router';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { InfoGrid } from '@/components/common/InfoGrid';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { toErrorMessage } from '@/domain/errors';
import type { SeedInfo } from '@/mock/seed';
import { resetDemo } from '@/services/admin-service';
import { formatDate, formatDateTime } from '@/utils/date';

const COUNT_LABEL: Record<string, string> = {
  records: 'Hồ sơ sửa chữa',
  occurrences: 'Lượt bảo trì',
  plans: 'Kế hoạch bảo trì',
  attachments: 'Tệp đính kèm',
  auditEvents: 'Sự kiện lịch sử',
} as const;

interface SeedResetCardProps {
  seedInfo: SeedInfo | null;
  counts: Record<string, number>;
}

/** Seed information, data counts and the confirmed demo reset (spec 9). */
export const SeedResetCard = ({ seedInfo, counts }: SeedResetCardProps) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const info = await resetDemo();
      setIsOpen(false);
      toast.success(`Đã khôi phục dữ liệu demo (ngày gốc ${formatDate(info.seedDate)}).`);
      navigate('/');
    } catch (error) {
      console.error('Reset demo failed:', error);
      toast.error(toErrorMessage(error));
    } finally {
      setIsResetting(false);
    }
  };

  const items = [
    { label: 'Ngày gốc dữ liệu mẫu (D)', value: seedInfo ? formatDate(seedInfo.seedDate) : 'Chưa có' },
    { label: 'Nạp lúc', value: seedInfo ? formatDateTime(seedInfo.seededAt) : '—' },
    ...Object.entries(counts).map(([key, value]) => ({ label: COUNT_LABEL[key] ?? key, value: String(value) })),
  ];

  return (
    <Card>
      <CardHeader
        title="Dữ liệu demo"
        description="Số hồ sơ, lượt và kế hoạch tính trong các tòa nhà của bạn; tệp và lịch sử tính toàn bộ."
        actions={
          <Button variant="danger" onClick={() => setIsOpen(true)}>
            <RotateCcw className="h-4 w-4" />
            Khôi phục dữ liệu demo
          </Button>
        }
      />
      <CardBody>
        <InfoGrid items={items} />
      </CardBody>
      <ConfirmDialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!isResetting) setIsOpen(open);
        }}
        title="Khôi phục dữ liệu demo?"
        confirmLabel="Xóa và nạp lại"
        confirmVariant="danger"
        isPending={isResetting}
        onConfirm={() => void handleReset()}
      >
        <p>
          Toàn bộ dữ liệu demo trong trình duyệt này sẽ bị <strong>xóa</strong>, gồm hồ sơ, lượt bảo trì, công việc, thông báo, lịch sử và mọi tệp đã tải
          lên. Sau đó dữ liệu mẫu được nạp lại với ngày gốc là hôm nay.
        </p>
        <p className="mt-2 text-ink-2">Thao tác không thể hoàn tác. Các tab khác đang mở sẽ tự cập nhật.</p>
      </ConfirmDialog>
    </Card>
  );
};
