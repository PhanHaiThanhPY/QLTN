import { ChevronRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { Tooltip } from '@/components/ui/tooltip';

export const SidebarAssistant = ({ isCollapsed }: { isCollapsed: boolean }) => {
  const link = (
    <Link
      to="/assistant"
      aria-label={isCollapsed ? 'An Nhi · AI' : undefined}
      className={
        isCollapsed
          ? 'flex size-10 items-center justify-center rounded-xl border border-cyan-200/25 bg-[#0d5968] text-cyan-100 transition-colors hover:bg-[#147487]'
          : 'flex items-center gap-3 rounded-xl border border-cyan-200/25 bg-gradient-to-r from-[#0d5968] to-[#0b3c5b] px-3 py-3 text-white shadow-sm transition-colors hover:border-cyan-200/45 hover:from-[#147487] hover:to-[#0d4d6d]'
      }
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-cyan-200/15 text-cyan-200">
        <Sparkles className="size-[18px]" aria-hidden />
      </span>
      {isCollapsed ? null : (
        <span className="min-w-0 flex-1 leading-tight">
          <strong className="block text-sm font-semibold">An Nhi · AI</strong>
          <span className="mt-1 block text-xs text-cyan-50/70">Hỗ trợ theo quyền tòa nhà</span>
        </span>
      )}
      {isCollapsed ? null : <ChevronRight className="size-4 shrink-0 text-cyan-100/80" aria-hidden />}
    </Link>
  );

  return <div className={`shrink-0 px-3 pb-3 ${isCollapsed ? 'flex justify-center' : ''}`}>{isCollapsed ? <Tooltip content="An Nhi · AI">{link}</Tooltip> : link}</div>;
};
