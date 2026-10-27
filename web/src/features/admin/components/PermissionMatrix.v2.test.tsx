// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { RoleDefinition, User } from '@/domain/types';
import { PermissionMatrixCard } from './PermissionMatrixCard';
import { RolesCard } from './RolesCard';

/** SPEC RM-S1 AC-1.8: matrix v2 columns and rows, RG-03 label, and the "Có quyền mới chưa bật" notice. */
vi.mock('./RoleDialog', () => ({ RoleDialog: () => null }));

const rowOf = (label: string) => screen.getByRole('rowheader', { name: new RegExp(label) }).closest('tr') as HTMLElement;
const allowedColumns = (row: HTMLElement): string[] =>
  within(row)
    .getAllByText(/^(Được làm|Không được làm)$/)
    .map((cell) => cell.textContent ?? '');

describe('PermissionMatrixCard (matrix v2)', () => {
  it('has a Kế toán column', () => {
    render(<PermissionMatrixCard />);
    expect(screen.getByRole('columnheader', { name: 'Kế toán' })).toBeTruthy();
  });

  it('puts "lập đề nghị thanh toán" under PAYMENT_RECORD, not under construction (RG-03)', () => {
    render(<PermissionMatrixCard />);
    expect(screen.queryByText(/Cập nhật thi công, lập đề nghị thanh toán/)).toBeNull();
    // Columns: ADMIN, BQL, KT, TVKT, BQT, Kế toán.
    expect(allowedColumns(rowOf('Lập đề nghị thanh toán'))).toEqual([
      'Không được làm',
      'Được làm',
      'Không được làm',
      'Không được làm',
      'Không được làm',
      'Không được làm',
    ]);
  });

  it('shows the new rows with the v2 holders', () => {
    render(<PermissionMatrixCard />);
    expect(allowedColumns(rowOf('Xác nhận đã chuyển khoản'))).toEqual([
      'Không được làm',
      'Không được làm',
      'Không được làm',
      'Không được làm',
      'Được làm',
      'Được làm',
    ]);
    expect(allowedColumns(rowOf('Ghi khoản thu, nhận cọc'))).toEqual([
      'Không được làm',
      'Không được làm',
      'Không được làm',
      'Không được làm',
      'Không được làm',
      'Được làm',
    ]);
    expect(allowedColumns(rowOf('Quản lý tầng, khu vực, vị trí'))).toEqual([
      'Được làm',
      'Được làm',
      'Không được làm',
      'Không được làm',
      'Không được làm',
      'Không được làm',
    ]);
    expect(allowedColumns(rowOf('Sửa cấu hình tòa'))[1]).toBe('Không được làm');
  });
});

describe('RolesCard notice', () => {
  const role = (overrides: Partial<RoleDefinition>): RoleDefinition => ({
    id: 'role-1',
    code: 'VT-90',
    name: 'BQT trước ma trận v2',
    baseRole: 'OWNERS_BOARD',
    capabilities: ['VIEW', 'PROPOSAL_DECIDE', 'PAYMENT_DECIDE', 'REPORT_VIEW'],
    isSystem: false,
    version: 1,
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
    ...overrides,
  });

  it('lists the new base capabilities a custom role has not enabled', () => {
    render(
      <MemoryRouter>
        <RolesCard
          roles={[role({ newBaseCapabilities: ['RECORD_CONFIRM', 'ACCEPTANCE_DECIDE', 'PAYMENT_CONFIRM'] })]}
          users={[] as User[]}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getAllByText('Có quyền mới chưa bật: Xác nhận hiện trạng, Nghiệm thu, Xác nhận đã chuyển khoản').length,
    ).toBeGreaterThan(0);
  });

  it('shows nothing when there is no new capability', () => {
    render(
      <MemoryRouter>
        <RolesCard roles={[role({ newBaseCapabilities: [] })]} users={[] as User[]} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/Có quyền mới chưa bật/)).toBeNull();
  });
});
