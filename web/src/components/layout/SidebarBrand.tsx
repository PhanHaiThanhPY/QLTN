import { Link } from 'react-router';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';

/** Logo mark: building outline with an azure entrance (also used as favicon). */
export const BrandMark = ({ className = 'size-9' }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden>
    <rect width="32" height="32" rx="8" className="fill-accent" />
    <path d="M9 25V9.5L16 6l7 3.5V25" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" />
    <path d="M13 13h2m2 0h2m-6 4h2m2 0h2" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <rect x="13" y="20" width="6" height="5" rx="1" className="fill-navy" />
  </svg>
);

interface SidebarBrandProps {
  isCollapsed: boolean;
  /** Desktop only: collapse/expand the rail. */
  onToggleCollapsed?: () => void;
}

export const SidebarBrand = ({ isCollapsed, onToggleCollapsed }: SidebarBrandProps) => {
  const toggle = onToggleCollapsed ? (
    <Tooltip content={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}>
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-sky-100/65 transition-colors hover:bg-white/10 hover:text-white"
        aria-label={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
      >
        {isCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
      </button>
    </Tooltip>
  ) : null;

  return (
    <div className={cn('flex shrink-0 items-center gap-2 border-b border-white/10 px-4', isCollapsed ? 'h-24 flex-col justify-center' : 'h-[4.75rem]')}>
      <Link to="/" className="flex min-w-0 flex-1 items-center gap-3" aria-label="Về Tổng quan">
        <BrandMark className="size-9 shrink-0" />
        {isCollapsed ? null : (
        <span className="min-w-0 leading-tight">
            <span className="block text-[0.9375rem] font-bold tracking-tight text-white">QLTN</span>
            <span className="block truncate text-2xs text-sky-100/60">Vận hành tòa nhà</span>
          </span>
        )}
      </Link>
      {toggle}
    </div>
  );
};
