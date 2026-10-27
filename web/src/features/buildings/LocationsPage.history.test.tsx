// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { LocationSettings } from '@/services/building-service';
import LocationsPage from './LocationsPage';

/**
 * SPEC RM-S1 AC-1.3a (PD-13) + FX-S3 BR-FX3-04 / AC-FX3.6: the locations screen shows BQL the whole building history
 * (locations and configuration), read-only, with no configuration action.
 */
const mocks = vi.hoisted(() => ({ query: { data: undefined as unknown, isLoading: false, error: null, refetch: vi.fn() } }));

vi.mock('@/hooks/useServiceQuery', () => ({ useServiceQuery: () => mocks.query }));
vi.mock('./components/LocationsCard', () => ({ LocationsCard: () => <p>Danh sách vị trí</p> }));
vi.mock('./components/BuildingPicker', () => ({ BuildingPicker: () => null }));

const SETTINGS: LocationSettings = {
  buildings: [],
  building: { id: 'bld-a', code: 'A', name: 'Tòa A', address: '12 Nguyễn Văn Linh' } as LocationSettings['building'],
  locations: [],
  audit: [
    {
      id: 'aud-1',
      subjectType: 'BUILDING',
      subjectId: 'bld-a',
      buildingId: 'bld-a',
      commandId: '',
      action: 'createLocation',
      actorId: 'usr-bql',
      entityVersion: 1,
      reason: 'Tầng 7 · Hành lang tầng 7',
      createdAt: '2026-10-26T09:00:00.000Z',
    },
    {
      id: 'aud-2',
      subjectType: 'BUILDING',
      subjectId: 'bld-a',
      buildingId: 'bld-a',
      commandId: '',
      action: 'applyConfigTemplate',
      actorId: 'usr-admin',
      entityVersion: 2,
      reason: 'Mẫu AQUA',
      createdAt: '2026-10-27T09:00:00.000Z',
    },
  ],
  canEdit: true,
};

describe('LocationsPage history', () => {
  const renderPage = () => {
    mocks.query.data = SETTINGS;
    render(
      <MemoryRouter>
        <LocationsPage />
      </MemoryRouter>,
    );
  };

  it('AC-FX3.6: shows location and configuration events of the building, and no configuration action', () => {
    renderPage();
    expect(screen.getByText('Lịch sử thay đổi tòa')).toBeTruthy();
    expect(screen.getByText(/Hành lang tầng 7/)).toBeTruthy();
    expect(screen.getByText(/Mẫu AQUA/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Áp dụng mẫu|Lưu/i })).toBeNull();
  });

  it('narrows the history to locations or configuration', () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Vị trí/ }));
    expect(screen.queryByText(/Mẫu AQUA/)).toBeNull();
    expect(screen.getByText(/Hành lang tầng 7/)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Cấu hình/ }));
    expect(screen.getByText(/Mẫu AQUA/)).toBeTruthy();
    expect(screen.queryByText(/Hành lang tầng 7/)).toBeNull();
  });
});
