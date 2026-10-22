// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { USER_ID } from '@/mock/seed-reference';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';
import { seedAt } from '@/test/helpers';
import { installNodeBlobs } from '@/test/node-blob';
import LoginPage from './index';

const renderLogin = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>Trang chủ demo</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

installNodeBlobs();

describe('LoginPage', () => {
  beforeEach(async () => {
    await seedAt();
    useSessionStore.getState().signOut();
  });

  afterEach(() => useSessionStore.getState().signOut());

  it('should list the demo accounts and sign in with the chosen one', async () => {
    renderLogin();

    const accountButton = await screen.findByRole('button', { name: /BQL-A/ });
    expect(screen.getAllByRole('button').length).toBe(7);

    fireEvent.click(accountButton);

    expect(useSessionStore.getState().userId).toBe(USER_ID.BQL_A);
    expect(await screen.findByText('Trang chủ demo')).toBeTruthy();
  });

  it('should drop the previous account assistant chat when another account signs in', async () => {
    useSessionStore.getState().signIn(USER_ID.ADMIN);
    useUiStore.getState().addAssistantMessage({ id: 'm1', role: 'assistant', content: 'Bí mật của admin' });
    useUiStore.getState().queueAssistantPrompt('Câu hỏi đang chờ');

    useSessionStore.getState().signIn(USER_ID.BQL_A);

    expect(useUiStore.getState().assistantMessages).toEqual([]);
    expect(useUiStore.getState().assistantQueuedPrompt).toBeNull();
    expect(sessionStorage.getItem('qltn-demo-assistant-messages')).toBe('[]');
  });
});
