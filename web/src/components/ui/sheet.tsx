import type { ReactNode } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Actions shown under the title (links, export…). */
  actions?: ReactNode;
  children: ReactNode;
}

/** Side panel from the right on desktop (full width on phones); keeps the page behind it in place. */
export const Sheet = ({ open, onOpenChange, title, description, actions, children }: SheetProps) => (
  <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-overlay backdrop-blur-[2px]" />
      <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl animate-fade-in flex-col border-l border-line bg-surface shadow-pop focus-visible:outline-none">
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 pb-4 pt-5 sm:px-6">
          <div className="min-w-0 space-y-1">
            <DialogPrimitive.Title className="text-lg font-semibold text-ink">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-sm text-ink-2">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
            {actions ? <div className="flex flex-wrap items-center gap-2 pt-2">{actions}</div> : null}
          </div>
          <DialogPrimitive.Close className="flex size-10 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Đóng">
            <X className="size-4.5" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
);
