import { useEffect } from 'react';
import { toast } from 'sonner';
import { toErrorMessage } from '@/domain/errors';

/** Surfaces promise rejections nobody caught: console for developers, a toast for the user. */
export const useUnhandledRejectionToast = (): void => {
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      toast.error(toErrorMessage(event.reason));
    };
    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, []);
};
