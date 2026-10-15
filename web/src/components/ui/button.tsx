import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

const PRIMARY = 'bg-[#0b2b49] text-white shadow-[0_6px_14px_-8px_rgb(7_26_48_/_0.55)] hover:bg-[#123f5f] active:translate-y-px';
const OUTLINE = 'border border-line-2 bg-surface text-ink shadow-sm hover:border-accent/35 hover:bg-accent-soft';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-[0.8125rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: PRIMARY,
        primary: PRIMARY,
        outline: OUTLINE,
        secondary: OUTLINE,
        navy: 'bg-[#071a30] text-white shadow-sm hover:bg-[#0d5968]',
        ghost: 'text-ink-2 hover:bg-surface-3 hover:text-ink',
        subtle: 'bg-surface-3 text-ink hover:bg-line',
        danger: 'bg-crit text-white shadow-sm hover:opacity-90 active:translate-y-px',
        link: 'px-0 text-accent underline-offset-4 hover:underline',
      },
      size: {
        xs: 'min-h-7 px-2 text-[0.6875rem]',
        sm: 'h-8 px-2.5 text-xs',
        md: 'h-8 px-3 text-xs',
        lg: 'h-9 px-3.5 text-[0.8125rem]',
        icon: 'h-8 w-8',
        'icon-sm': 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

/** VMI button. Loading keeps the size stable and blocks double clicks. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading = false, disabled, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
