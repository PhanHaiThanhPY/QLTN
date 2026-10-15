import type { ReactNode } from 'react';
import { Tooltip as TooltipPrimitive } from 'radix-ui';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

export const TooltipProvider = TooltipPrimitive.Provider;

export const Tooltip = ({ content, children }: TooltipProps) => (
  <TooltipPrimitive.Root delayDuration={150}>
    <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content sideOffset={6} className="z-50 max-w-xs rounded-lg bg-navy px-3 py-2 text-xs leading-relaxed text-navy-ink shadow-pop">
        {content}
        <TooltipPrimitive.Arrow className="fill-navy" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  </TooltipPrimitive.Root>
);
