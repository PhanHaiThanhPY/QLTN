import type { ReactNode } from 'react';
import { Tag } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface DetailHeaderCardProps {
  code: string;
  title: string;
  badges?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}

/** VMI detail header: name, code, status badges and main actions. */
export const DetailHeaderCard = ({ code, title, badges, meta, actions }: DetailHeaderCardProps) => (
  <Card className="p-4 sm:p-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Tag>{code}</Tag>
          {badges}
        </div>
        <p className="text-lg font-semibold tracking-tight text-ink">{title}</p>
        {meta ? <div className="text-sm text-ink-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div> : null}
    </div>
  </Card>
);
