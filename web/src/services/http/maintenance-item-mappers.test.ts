import { apiRequest } from './client';
import { MAINTENANCE_ITEM_COMMANDS, mapMaintenanceItem } from './maintenance-item-mappers';
import type { ApiMaintenanceItem } from './maintenance-item-mappers';

vi.mock('./client', () => ({ apiRequest: vi.fn() }));
vi.mock('../change-channel', () => ({ broadcastChange: vi.fn() }));

const apiItem: ApiMaintenanceItem = {
  id: 'itm-1',
  code: 'BOM-A09',
  buildingId: 'bld-a',
  locationId: 'loc-1',
  name: 'Bơm tăng áp',
  type: 'Bơm nước',
  ownerUserId: 'usr-1',
  model: null,
  supplier: 'Sao Việt',
  installDate: null,
  warrantyUntil: '2026-11-16',
  description: null,
  documentIds: [],
  condition: 'NEEDS_ATTENTION',
  conditionNote: 'Rỉ nước',
  active: false,
  deactivatedAt: '2026-10-25T02:00:00.000Z',
  deactivationReason: 'Thay bơm mới.',
  version: 3,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-25T02:00:00.000Z',
};

describe('equipment API mapping (MT-S1)', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockResolvedValue(apiItem);
  });
  afterEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('maps an item, leaving null fields out', () => {
    const item = mapMaintenanceItem(apiItem);
    expect(item).toMatchObject({ code: 'BOM-A09', supplier: 'Sao Việt', condition: 'NEEDS_ATTENTION', active: false, deactivationReason: 'Thay bơm mới.' });
    expect('model' in item).toBe(false);
  });

  it('never sends the code on an edit (BR-MT-06) and sends the loaded version', async () => {
    await MAINTENANCE_ITEM_COMMANDS.updateMaintenanceItem({
      commandId: 'cmd-1',
      subjectType: 'MAINTENANCE_ITEM',
      subjectId: 'itm-1',
      expectedVersion: 3,
      action: 'updateMaintenanceItem',
      payload: { code: 'BOM-X', name: 'Bơm', type: 'Bơm nước', locationId: 'loc-1', ownerUserId: 'usr-1', model: '' },
    });
    const [method, path, options] = vi.mocked(apiRequest).mock.calls[0];
    expect([method, path]).toEqual(['PATCH', '/maintenance-items/itm-1']);
    expect(options?.body).toMatchObject({ version: 3, name: 'Bơm', model: null });
    expect(options?.body).not.toHaveProperty('code');
  });

  it('routes deactivate, reactivate, condition and documents to their endpoints', async () => {
    const base = { commandId: 'cmd', subjectType: 'MAINTENANCE_ITEM' as const, subjectId: 'itm-1', expectedVersion: 3 };
    await MAINTENANCE_ITEM_COMMANDS.deactivateMaintenanceItem({ ...base, action: 'deactivateMaintenanceItem', payload: { reason: 'Thay bơm mới.' } });
    await MAINTENANCE_ITEM_COMMANDS.reactivateMaintenanceItem({ ...base, action: 'reactivateMaintenanceItem', payload: { reason: 'Ngừng nhầm.' } });
    await MAINTENANCE_ITEM_COMMANDS.updateItemCondition({ ...base, action: 'updateItemCondition', payload: { condition: 'GOOD', note: 'Đã thay phớt.' } });
    await MAINTENANCE_ITEM_COMMANDS.setItemDocuments({ ...base, action: 'setItemDocuments', payload: { documentIds: ['att-1'] } });
    expect(vi.mocked(apiRequest).mock.calls.map(([method, path]) => `${method} ${path}`)).toEqual([
      'POST /maintenance-items/itm-1/deactivate',
      'POST /maintenance-items/itm-1/reactivate',
      'POST /maintenance-items/itm-1/condition',
      'PUT /maintenance-items/itm-1/documents',
    ]);
  });
});
