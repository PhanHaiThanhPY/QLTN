import { Moon, Sun } from 'lucide-react';
import { useUiStore } from '@/store/ui-store';

export const ThemeToggle = () => {
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex size-11 items-center justify-center rounded-lg border border-line bg-surface text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
      aria-label={isDark ? 'Chuyển chế độ sáng' : 'Chuyển chế độ tối'}
    >
      {isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
};
