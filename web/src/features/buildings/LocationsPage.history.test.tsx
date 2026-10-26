// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { LocationSettings } from '@/services/building-service';
import LocationsPage from './LocationsPage';

/** SPEC RM-S1 AC-1.3a (PD-13): the locations screen shows BQL the history card, read-only, with no configuration action. */
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
  ],
  canEdit: true,
};

describe('LocationsPage history', () => {
  it('shows the location history card and no configuration action', () => {
    mocks.query.data = SETTINGS;
    render(
      <MemoryRouter>
        <LocationsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Lịch sử thay đổi vị trí')).toBeTruthy();
    expect(screen.getByText(/Hành lang tầng 7/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /cấu hình|Áp dụng mẫu|Lưu/i })).toBeNull();
  });
});
