import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import type { BreadcrumbItem } from '@/components/ui/breadcrumb';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Child pages: path above the title. */
  breadcrumbs?: BreadcrumbItem[];
  backTo?: string;
  backLabel?: string;
  /** Detail pages whose header card already shows the name: keep only the breadcrumb visible. */
  isCompact?: boolean;
}

/** Page title block in the body: breadcrumb, large title, description and actions on the right. */
export const PageHeader = ({ title, description, actions, breadcrumbs, backTo, backLabel = 'Quay lại', isCompact = false }: PageHeaderProps) => {
  useEffect(() => {
    if (typeof title === 'string') document.title = `${title} · QLTN`;
  }, [title]);

  if (isCompact) {
    return (
      <div className="mb-4">
        {breadcrumbs?.length ? <Breadcrumb items={breadcrumbs} className="mb-0" /> : null}
        <h1 className="sr-only">{title}</h1>
      </div>
    );
  }

  return (
    <div className="mb-5">
      {breadcrumbs?.length ? <Breadcrumb items={breadcrumbs} /> : null}
      {!breadcrumbs?.length && backTo ? (
        <Link to={backTo} className="mb-2 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-ink-3 hover:text-accent">
          <ChevronLeft className="size-4" />
          {backLabel}
        </Link>
      ) : null}
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[1.6rem] font-bold tracking-[-0.035em] text-ink sm:text-[1.85rem]">{title}</h1>
          {description ? <div className="mt-1.5 max-w-3xl text-[0.9rem] leading-5 text-ink-2">{description}</div> : null}
        </div>
        {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
      </div>
    </div>
  );
};
