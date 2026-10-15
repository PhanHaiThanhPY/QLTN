import { cn } from '@/lib/cn';

export const Skeleton = ({ className }: { className?: string }) => <div className={cn('animate-pulse rounded-md bg-surface-3', className)} />;
