import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Building2, Globe2, Menu, Search } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import type { User } from '@/domain/types';
import { searchGlobal } from '@/services/global-search-service';
import type { GlobalSearchResult } from '@/services/global-search-service';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useUiStore } from '@/store/ui-store';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { AssistantHeaderButton } from '@/components/assistant/AssistantPanel';

const todayLabel = (): string =>
  new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

/** Content header: global search, date and scope, theme, notifications, and language. */
export const AppHeader = ({ user }: { user?: User }) => {
  const navigate = useNavigate();
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const { data } = useReferenceData();
  const scope = (data?.buildings ?? []).map((building) => building.code).join(', ');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const normalizedSearch = search.trim();
  const searchQueryKey = useMemo(() => ['global-search', normalizedSearch] as const, [normalizedSearch]);
  const searchQueryFn = useCallback(() => searchGlobal(normalizedSearch), [normalizedSearch]);
  const searchQuery = useServiceQuery(searchQueryKey, searchQueryFn, searchOpen && normalizedSearch.length >= 2);
  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(normalizedSearch ? `/records?q=${encodeURIComponent(normalizedSearch)}` : '/records');
    setSearchOpen(false);
  };
  const openResult = (result: GlobalSearchResult) => {
    navigate(result.href);
    setSearch('');
    setSearchOpen(false);
  };
  return (
    <header className="sticky top-0 z-20 flex min-h-16 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 sm:gap-4 sm:px-6 lg:px-8">
      <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Mở menu">
        <Menu className="size-5" />
      </Button>
      <div className="hidden min-w-0 flex-1 lg:flex">
        <form className="relative w-full max-w-[36rem]" onSubmit={handleSearch}>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-line-2 bg-surface-2 px-3 text-sm text-ink-3 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/10">
            <Search className="size-[18px] shrink-0" aria-hidden />
            <input
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-3"
              placeholder="Tìm hồ sơ, thiết bị, công việc..."
              aria-label="Tìm hồ sơ, thiết bị, công việc"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
            />
            <kbd className="hidden rounded border border-line bg-surface px-1.5 py-0.5 text-[0.6875rem] font-semibold text-ink-3 xl:inline">⌘ K</kbd>
          </label>
          {searchOpen && normalizedSearch.length >= 2 ? (
            <div className="absolute left-0 right-0 top-12 z-30 overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
              {searchQuery.isLoading ? <p className="px-4 py-3 text-sm text-ink-2">Đang tìm...</p> : null}
              {!searchQuery.isLoading && searchQuery.data?.length === 0 ? <p className="px-4 py-3 text-sm text-ink-2">Không tìm thấy kết quả phù hợp.</p> : null}
              {searchQuery.data?.map((result) => (
                <button
                  key={`${result.kind}-${result.id}`}
                  type="button"
                  className="flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-surface-2"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => openResult(result)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{result.code} · {result.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-ink-2">{result.kindLabel} · {result.subtitle}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </form>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        {user ? (
          <div className="hidden items-center gap-2.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 leading-tight xl:flex">
            <Building2 className="size-4 shrink-0 text-accent" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-[0.6875rem] font-semibold text-ink-3">{todayLabel()}</p>
              <p className="mt-0.5 truncate text-xs font-semibold text-ink-2">Tòa {scope || '—'}</p>
            </div>
          </div>
        ) : null}
        <div className="flex items-center gap-2 border-l border-line pl-2 sm:gap-3 sm:pl-3">
          <AssistantHeaderButton />
          <ThemeToggle />
          <NotificationBell />
        </div>
        <span className="hidden items-center gap-1.5 border-l border-line pl-3 text-sm font-semibold text-ink-2 sm:inline-flex">
          <Globe2 className="size-4" aria-hidden />
          VI
        </span>
      </div>
    </header>
  );
};
