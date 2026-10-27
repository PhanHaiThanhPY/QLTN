import type { ReactNode } from 'react';
import { DropdownMenu } from 'radix-ui';
import { cn } from '@/lib/cn';

export interface ActionMenuItem {
  key: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  tone?: 'danger';
}

interface ActionMenuProps {
  /** The trigger, usually a `Button`; it receives the menu's aria props. */
  trigger: ReactNode;
  items: readonly ActionMenuItem[];
  align?: 'start' | 'end';
}

/** A keyboard-usable menu of actions (radix DropdownMenu): arrows move, Enter picks, Esc closes and returns focus. */
export const ActionMenu = ({ trigger, items, align = 'end' }: ActionMenuProps) => (
  <DropdownMenu.Root modal={false}>
    <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={4}
        className="z-50 min-w-44 rounded-lg border border-line bg-surface p-1 shadow-card"
      >
        {items.map((item) => (
          <DropdownMenu.Item
            key={item.key}
            disabled={item.disabled}
            onSelect={item.onSelect}
            className={cn(
              'cursor-pointer rounded-md px-2.5 py-2 text-sm outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2',
              item.tone === 'danger' ? 'text-crit' : 'text-ink',
            )}
          >
            {item.label}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
);
