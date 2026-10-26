import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listAccountHistory, type HistorySubject } from '@/services/http/users-api';
import { AccountHistoryList } from './AccountHistoryList';

export const accountHistoryKey = (subjectId: string, subject: HistorySubject = 'users') =>
  ['account-history', subject, subjectId] as const;

interface AccountHistoryProps {
  subjectId: string;
  /** Accounts by default; roles and departments reuse the block (SPEC AD-S1 §3 step 7). */
  subject?: HistorySubject;
}

/** Collapsible history in the employee, role or department dialog (api mode); loads when opened, 20 rows per page. */
export const AccountHistory = ({ subjectId, subject = 'users' }: AccountHistoryProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const query = useInfiniteQuery({
    queryKey: accountHistoryKey(subjectId, subject),
    queryFn: ({ pageParam }) => listAccountHistory(subjectId, pageParam, subject),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled: isOpen,
  });
  const rows = query.data?.pages.flatMap((page) => page.rows) ?? [];
  const Chevron = isOpen ? ChevronDown : ChevronRight;

  return (
    <section className="rounded-xl border border-line">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-ink"
      >
        <Chevron className="size-4 text-ink-3" />
        Lịch sử
      </button>
      {isOpen ? (
        <div className="border-t border-line px-4 py-3">
          <AccountHistoryList
            rows={rows}
            isLoading={query.isLoading}
            error={query.error}
            onRetry={() => void query.refetch()}
          />
          {query.hasNextPage ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              isLoading={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              Xem thêm
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
