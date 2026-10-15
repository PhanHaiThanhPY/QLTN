import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import './index.css';
import { Providers } from '@/app/providers';
import { router } from '@/app/router';
import { BootScreen } from '@/app/BootScreen';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { registerAllHandlers } from '@/services/handlers';
import { ensureSeeded } from '@/mock/seed';
import { toErrorMessage } from '@/domain/errors';

const root = createRoot(document.getElementById('root') as HTMLElement);

const boot = async (): Promise<void> => {
  root.render(<BootScreen message="Đang chuẩn bị dữ liệu demo…" />);
  try {
    registerAllHandlers();
    await ensureSeeded();
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
