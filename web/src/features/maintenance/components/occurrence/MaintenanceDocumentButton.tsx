import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { OccurrenceDetail } from '@/services/maintenance-service';
import { useReferenceData } from '@/hooks/useReferenceData';
import { openPrintableHtml } from '@/utils/print-document';
import { buildMaintenanceChecklistHtml } from '../../utils/maintenance-document';

export const MaintenanceDocumentButton = ({ detail }: { detail: OccurrenceDetail }) => {
  const lookup = useReferenceData();
  const handleOpen = () => {
    const opened = openPrintableHtml(buildMaintenanceChecklistHtml(detail, lookup));
    if (!opened) toast.error('Không mở được bản xem trước. Hãy cho phép cửa sổ bật lên của trình duyệt.');
  };
  return (
    <Button variant="secondary" size="sm" onClick={handleOpen}>
      <FileText className="h-4 w-4" />
      Biên bản / PDF
    </Button>
  );
};
