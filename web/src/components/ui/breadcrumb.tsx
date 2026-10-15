import { Link } from 'react-router';
import { ChevronRight, House } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface BreadcrumbItem {
  label: string;
  /** Empty on the last item (current page). */
  to?: string;
}

export const Breadcrumb = ({ items, className }: { items: readonly BreadcrumbItem[]; className?: string }) => (
  <nav aria-label="Đường dẫn" className={cn('mb-3', className)}>
    <ol className="flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-ink-3">
      <li className="flex items-center">
        <Link to="/" aria-label="Trang chủ" className="flex items-center hover:text-ink-2">
          <House className="size-3.5" aria-hidden />
        </Link>
      </li>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <li key={`${item.label}-${index}`} aria-current={isLast ? 'page' : undefined} className="flex items-center gap-1.5">
            <ChevronRight className="size-3.5 shrink-0" aria-hidden />
            {isLast || !item.to ? (
              <span className={isLast ? 'font-medium text-ink-2' : undefined}>{item.label}</span>
            ) : (
              <Link to={item.to} className="hover:text-ink-2">
                {item.label}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);
