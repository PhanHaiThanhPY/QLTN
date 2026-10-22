import { Loader2 } from 'lucide-react';
import { IS_API_MODE } from '@/config/data-source';
import { resetDatabase } from '@/services/admin-service';

interface BootScreenProps {
  message: string;
  isError?: boolean;
}

/** Shown while seeding on first open, restoring the api session, or when the stored schema cannot be opened. */
export const BootScreen = ({ message, isError = false }: BootScreenProps) => {
  const handleReset = async () => {
    try {
      await resetDatabase();
      window.location.reload();
    } catch (error) {
      console.error('Reset failed:', error);
    }
  };
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
      {isError ? null : <Loader2 className="h-8 w-8 animate-spin text-accent" />}
      <p className={isError ? 'max-w-md text-danger' : 'text-ink-2'}>{message}</p>
      {isError && !IS_API_MODE ? (
      <button type="button" className="rounded-md bg-[#0b2b49] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#123f5f]" onClick={() => void handleReset()}>
          Xóa dữ liệu demo và khởi tạo lại
        </button>
      ) : null}
    </div>
  );
};
