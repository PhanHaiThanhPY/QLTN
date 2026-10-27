import { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { Notice } from '@/components/common/Notice';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { isAppError } from '@/domain/errors';
import { useOnline } from '@/hooks/useOnline';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getRecordDetail } from '@/services/records-service';
import { useSessionStore } from '@/store/session-store';
import { buildDocument } from './build-document';
import { DocumentView } from './components/DocumentView';
import { isDocumentKind } from './document-list';
import type { PrintNames } from './print-format';

const NotFound = () => (
  <main className="mx-auto max-w-md px-4 py-16 text-center">
    <h1 className="text-lg font-semibold text-ink">Không tìm thấy hồ sơ hoặc tài liệu</h1>
    <Link to="/records" className="mt-4 inline-block text-sm text-accent hover:underline">
      Về danh sách hồ sơ
    </Link>
  </main>
);

/**
 * /records/:recordId/documents/:kind/:docId (SPEC B7-S1 ui-brief §2.2): one D5 document on its own page, outside the
 * app shell so the print holds only the paper. Scope is the record detail's: outside it the API answers 404 and
 * nothing of the record is shown (BR-B7-02, AC-B7.3).
 */
const DocumentPrintPage = () => {
  const { recordId = '', kind, docId = '' } = useParams();
  const userId = useSessionStore((state) => state.userId);
  const isOnline = useOnline();
  const reference = useReferenceData();
  const query = useServiceQuery(['record', recordId], () => getRecordDetail(recordId));
  const names = useMemo<PrintNames>(() => {
    const people = new Map((reference.data?.users ?? []).map((user) => [user.id, user.fullName]));
    return { person: (id) => (id ? (people.get(id) ?? '') : ''), building: reference.buildingName };
  }, [reference.data?.users, reference.buildingName]);

  if (!userId) return <Navigate to="/login" replace />;
  if (!isDocumentKind(kind)) return <NotFound />;
  if (query.error) {
    if (isAppError(query.error) && (query.error.code === 'NOT_FOUND' || query.error.code === 'FORBIDDEN')) return <NotFound />;
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <Notice tone="danger" title={isOnline ? 'Không tải được tài liệu' : 'Đang mất kết nối — không tải được tài liệu.'}>
          <Button className="mt-2" variant="outline" size="sm" onClick={() => void query.refetch()}>
            Thử lại
          </Button>
        </Notice>
      </main>
    );
  }
  if (query.isLoading || reference.isLoading || !query.data) {
    return (
      <main className="mx-auto mt-16 w-[min(210mm,calc(100%-32px))]" aria-busy="true">
        <Skeleton className="h-[297mm] w-full" />
      </main>
    );
  }
  const document = buildDocument(query.data, kind, docId, names);
  if (!document) return <NotFound />;
  return <DocumentView recordId={recordId} recordCode={query.data.record.code} document={document} />;
};

export default DocumentPrintPage;
