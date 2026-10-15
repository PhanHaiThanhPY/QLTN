/** Small counter shown next to a tab label (highlighted by Tabs when the tab is active). */
export const TabCount = ({ value }: { value: number }) => (
  <span className="tab-badge tnum rounded-full bg-surface-3 px-1.5 py-px text-[0.6875rem] font-semibold text-ink-2">{value}</span>
);
