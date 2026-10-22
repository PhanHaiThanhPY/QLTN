import type { Building, Department, Location, MaintenanceItem, User } from '@/domain/types';
import { getDb } from '@/storage/db';
import { requireViewer } from './viewer';

export interface ReferenceData {
  viewer: User;
  buildings: Building[];
  departments: Department[];
  locations: Location[];
  users: User[];
  items: MaintenanceItem[];
}

/** Lookup lists limited to the viewer's buildings. */
export const getReferenceData = async (): Promise<ReferenceData> => {
  const viewer = await requireViewer();
  const db = getDb();
  const scope = new Set(viewer.buildingIds);
  const [buildings, departments, locations, users, items] = await Promise.all([
    db.buildings.toArray(),
    db.departments.toArray(),
    db.locations.toArray(),
    db.users.toArray(),
    db.maintenanceItems.toArray(),
  ]);
  return {
    viewer,
    buildings: buildings.filter((row) => scope.has(row.id)),
    departments: departments.filter((row) => row.buildingIds.length === 0 || row.buildingIds.some((id) => scope.has(id))),
    locations: locations.filter((row) => scope.has(row.buildingId)),
    users: users.filter((row) => row.buildingIds.some((id) => scope.has(id))),
    items: items.filter((row) => scope.has(row.buildingId)).sort((a, b) => a.code.localeCompare(b.code)),
  };
};

const DEMO_ACCOUNT_CODES = new Set(['ADMIN-DEMO', 'BQL-A', 'KT-A', 'KT-A2', 'KT-B', 'TVKT', 'BQT']);

/** Curated demo account list for the "Vào demo" screen; this is a simulated login, not authentication. */
export const listDemoAccounts = async (): Promise<User[]> => {
  const users = await getDb().users.toArray();
  return users.filter((user) => DEMO_ACCOUNT_CODES.has(user.code)).sort((a, b) => a.code.localeCompare(b.code));
};
