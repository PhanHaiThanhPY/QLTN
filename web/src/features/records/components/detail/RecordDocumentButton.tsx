import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useReferenceData } from '@/hooks/useReferenceData';
import { openPrintableHtml } from '@/utils/print-document';
import { useRecordContext } from '../../record-context';
import { buildRepairDocumentHtml } from './record-document';

/** Opens the current repair record's forms as a printable bundle. */
export const RecordDocumentButton = () => {
  const { detail } = useRecordContext();
  const { buildingName, locationName, userName } = useReferenceData();

  const openPreview = () => {
    try {
      const html = buildRepairDocumentHtml(detail, { buildingName, locationName, userName });
      if (!openPrintableHtml(html)) {
        toast.error('Trình duyệt đang chặn cửa sổ xem biểu mẫu. Hãy cho phép popup rồi thử lại.');
      }
    } catch (error) {
      console.error('Open document bundle failed:', error);
      toast.error('Không thể mở bộ biểu mẫu. Vui lòng thử lại.');
    }
  };

  return (
    <Button variant="secondary" onClick={openPreview}>
      <FileText className="h-4 w-4" />
      Xem bộ biểu mẫu
    </Button>
  );
};
