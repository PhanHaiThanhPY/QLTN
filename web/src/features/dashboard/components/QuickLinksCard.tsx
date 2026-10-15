import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { User } from '@/domain/types';
import { NAV_ITEMS } from '@/app/navigation';
import { hasCapability } from '@/domain/permissions';

const EXCLUDED = new Set(['/', '/tasks']);

/** Shortcuts to the main screens the viewer may open (same rules as the sidebar). */
export const QuickLinksCard = ({ viewer }: { viewer: User }) => {
  const items = NAV_ITEMS.filter((item) => !EXCLUDED.has(item.to) && (!item.capability || hasCapability(viewer, item.capability)));
  return (
    <Card>
      <CardHeader title="Lối tắt" />
      <CardBody>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="flex min-h-11 items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-sm text-ink hover:border-accent/50 hover:bg-surface-2"
              >
                <item.icon className="size-4 shrink-0 text-accent" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
};
