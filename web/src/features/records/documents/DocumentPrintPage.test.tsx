// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AppError, ERROR_CODE } from '@/domain/errors';
import DocumentPrintPage from './DocumentPrintPage';

/** SPEC B7-S1 AC-B7.3 / ui-brief §4: a record outside the viewer's buildings shows "not found" and no data. */
const state = vi.hoisted(() => ({ query: { data: undefined as unknown, error: null as unknown, isLoading: false, refetch: vi.fn() } }));
vi.mock('@/hooks/useServiceQuery', () => ({ useServiceQuery: () => state.query }));
vi.mock('@/hooks/useReferenceData', () => ({ useReferenceData: () => ({ data: { users: [] }, isLoading: false, buildingName: () => 'Tòa A' }) }));
vi.mock('@/store/session-store', () => ({ useSessionStore: (pick: (value: { userId: string }) => unknown) => pick({ userId: 'usr-bql-b' }) }));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/records/:recordId/documents/:kind/:docId" element={<DocumentPrintPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('DocumentPrintPage', () => {
  it('AC-B7.3: a 404 from the record detail shows only "Không tìm thấy hồ sơ hoặc tài liệu"', () => {
    state.query = { data: undefined, error: new AppError(ERROR_CODE.NOT_FOUND, 'Không tìm thấy hồ sơ.'), isLoading: false, refetch: vi.fn() };
    renderAt('/records/rec-a/documents/proposal/sub-1');
    expect(screen.getByRole('heading', { name: 'Không tìm thấy hồ sơ hoặc tài liệu' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Về danh sách hồ sơ' }).getAttribute('href')).toBe('/records');
    expect(document.querySelector('.d5-sheet')).toBeNull();
  });

  it('treats an unknown document kind as not found', () => {
    state.query = { data: undefined, error: null, isLoading: true, refetch: vi.fn() };
    renderAt('/records/rec-a/documents/contract/x');
    expect(screen.getByRole('heading', { name: 'Không tìm thấy hồ sơ hoặc tài liệu' })).toBeTruthy();
  });
});
