import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import './index.css';
import { Providers } from '@/app/providers';
import { router } from '@/app/router';
import { BootScreen } from '@/app/BootScreen';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { IS_API_MODE } from '@/config/data-source';
import { registerAllHandlers } from '@/services/handlers';
import { ensureSeeded } from '@/mock/seed';
import { bootstrapApiSession } from '@/store/session-store';
import { toErrorMessage } from '@/domain/errors';

const root = createRoot(document.getElementById('root') as HTMLElement);

const boot = async (): Promise<void> => {
  root.render(<BootScreen message={IS_API_MODE ? 'Đang kết nối máy chủ…' : 'Đang chuẩn bị dữ liệu demo…'} />);
  try {
    registerAllHandlers();
    // api mode reads/writes the real backend: no demo seed and no IndexedDB boot work.
    if (IS_API_MODE) await bootstrapApiSession();
    else await ensureSeeded();
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <Providers>
            <RouterProvider router={router} />
          </Providers>
        </ErrorBoundary>
      </StrictMode>,
    );
  } catch (error) {
    console.error('Boot failed:', error);
    root.render(<BootScreen message={toErrorMessage(error)} isError />);
  }
};

void boot();
