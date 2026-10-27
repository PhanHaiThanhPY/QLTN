import { Printer } from 'lucide-react';
import { EmptyState } from '@/components/common/States';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { useRecordContext } from '../../record-context';
import { buildDocumentList } from '../document-list';
import { printDate } from '../print-format';

/**
 * Tab "Biểu mẫu" (SPEC B7-S1 BR-B7-01, ui-brief §2.1), api mode: every printable document of the record, oldest first.
 * "Xem / In" opens the paper view in a new browser tab so the detail screen stays open.
 */
export const DocumentsTab = () => {
  const { detail } = useRecordContext();
  const rows = buildDocumentList(detail);
  return (
    <Card>
      <CardHeader
        title="Biểu mẫu"
        description="Bản xem và in theo mẫu của Ban quản lý. Dùng “In” của trình duyệt để lưu PDF. Bản in dùng để lưu và trình xem; văn bản chính thức ký ngoài hệ thống."
      />
      <CardBody>
        {rows.length === 0 ? (
          <EmptyState
            title="Chưa có tài liệu nào để in"
            description="Tài liệu xuất hiện khi hồ sơ được trình, nghiệm thu hoặc đề nghị thanh toán."
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <li key={`${row.kind}-${row.docId}`} className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center lg:grid-cols-[minmax(0,1fr)_7rem_9rem_7rem_auto]">
                <div className="min-w-0 lg:contents">
                  <p className="truncate font-medium text-ink">{row.title}</p>
                  <p className="text-sm text-ink-2">{printDate(row.date)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 lg:contents">
                  <Badge tone={row.tone}>{row.status}</Badge>
                  <span className="text-sm text-ink-2">
                    Chữ ký {row.signed}/{row.signatureSlots}
                  </span>
                  {row.printable ? (
                    <a
                      href={`/records/${detail.record.id}/documents/${row.kind}/${row.docId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full sm:w-auto')}
                      aria-label={`Xem / In ${row.title}`}
                    >
                      <Printer aria-hidden />
                      Xem / In
                    </a>
                  ) : (
                    <span className="text-sm text-ink-3">{row.note}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
};
