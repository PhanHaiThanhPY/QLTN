import type { ReactNode } from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from '@/lib/cn';

export interface TabItem {
  value: string;
  label: ReactNode;
  badge?: ReactNode;
}

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  items: TabItem[];
  children: ReactNode;
}

/** Segmented tabs: compact azure active state with a light surface container. */
export const Tabs = ({ value, onValueChange, items, children }: TabsProps) => (
  <TabsPrimitive.Root value={value} onValueChange={onValueChange}>
    <TabsPrimitive.List className="scroll-thin -mx-1 flex items-center gap-0.5 overflow-x-auto rounded-lg bg-surface-2 p-0.5 px-0.5 pb-0.5">
      {items.map((item) => (
        <TabsPrimitive.Trigger
          key={item.value}
          value={item.value}
          className={cn(
            'flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-transparent px-3 text-xs font-medium text-ink-2 transition-colors',
            'hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            'data-[state=active]:bg-surface data-[state=active]:text-accent data-[state=active]:shadow-sm',
            '[&[data-state=active]_.tab-badge]:bg-accent-soft [&[data-state=active]_.tab-badge]:text-accent',
          )}
        >
          {item.label}
          {item.badge}
        </TabsPrimitive.Trigger>
      ))}
    </TabsPrimitive.List>
    {children}
  </TabsPrimitive.Root>
);

export const TabPanel = ({ value, children }: { value: string; children: ReactNode }) => (
  <TabsPrimitive.Content value={value} className="mt-4 animate-fade-in focus-visible:outline-none">
    {children}
  </TabsPrimitive.Content>
);
