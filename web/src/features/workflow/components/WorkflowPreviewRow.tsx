import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface WorkflowPreviewRowProps {
  icon: LucideIcon;
  label: string;
  description: string;
  tone: 'good' | 'accent';
}

/** One step line inside the workflow preview dialog. */
export const WorkflowPreviewRow = ({ icon: Icon, label, description, tone }: WorkflowPreviewRowProps) => (
  <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-3">
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg',
        tone === 'good' ? 'bg-good-soft text-good' : 'bg-accent-soft text-accent',
      )}
    >
      <Icon className="size-4" />
    </span>
    <div>
      <p className="text-sm font-semibold text-ink">{label}</p>
      <p className="text-xs text-ink-2">{description}</p>
    </div>
  </div>
);
