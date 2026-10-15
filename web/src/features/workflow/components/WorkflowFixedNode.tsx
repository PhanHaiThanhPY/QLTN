import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface WorkflowFixedNodeProps {
  icon: LucideIcon;
  label: string;
  description: string;
  tone: 'good' | 'accent';
}

/** System node (start / end) that cannot be edited. */
export const WorkflowFixedNode = ({ icon: Icon, label, description, tone }: WorkflowFixedNodeProps) => (
  <div className={cn('z-10 flex min-w-44 items-center gap-3 rounded-xl border bg-surface px-4 py-3 shadow-sm', tone === 'good' ? 'border-good/30' : 'border-accent/30')}>
    <span className={cn('flex size-9 items-center justify-center rounded-lg', tone === 'good' ? 'bg-good-soft text-good' : 'bg-accent-soft text-accent')}><Icon className="size-5" /></span>
    <div><p className="text-sm font-semibold text-ink">{label}</p><p className="text-2xs text-ink-3">{description}</p></div>
  </div>
);
