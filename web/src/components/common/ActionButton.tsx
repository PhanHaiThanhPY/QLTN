import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { ButtonProps } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import type { ActionState } from '@/domain/actions';

interface ActionButtonProps extends Omit<ButtonProps, 'disabled'> {
  state: ActionState;
  children: ReactNode;
}

/** Business action button: when not allowed it stays visible, disabled, with the reason (spec 11.1). */
export const ActionButton = ({ state, children, ...props }: ActionButtonProps) => {
  if (state.allowed) return <Button {...props}>{children}</Button>;
  return (
    <Tooltip content={state.reason ?? 'Không khả dụng'}>
      <span tabIndex={0} className="inline-flex" aria-label={state.reason}>
        <Button {...props} disabled className={`${props.className ?? ''} pointer-events-none`}>
          {children}
        </Button>
      </span>
    </Tooltip>
  );
};
