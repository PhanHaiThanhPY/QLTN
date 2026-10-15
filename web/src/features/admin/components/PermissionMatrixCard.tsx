import { Check, Minus } from 'lucide-react';
import { Notice } from '@/components/common/Notice';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ROLE_LABEL } from '@/domain/constants';
import type { Role } from '@/domain/constants';
import { hasCapability } from '@/domain/permissions';
import { MATRIX_ROLES, PERMISSION_ROWS } from '../permission-rows';
import type { PermissionRow } from '../permission-rows';

const isAllowed = (row: PermissionRow, role: Role): boolean =>
  row.capability === 'ALL' || hasCapability({ role, active: true }, row.capability);

/**
 * Permission matrix rendered from the live role rules (spec section 3).
 * Uses a scrollable grid inside the card so the page itself never scrolls sideways.
 */
export const PermissionMatrixCard = () => (
  <Card>
    <CardHeader title="Ma trận quyền" description="Tính trực tiếp từ quy tắc phân quyền đang chạy trong demo. Mọi quyền chỉ áp dụng trong tòa nhà được gán." />
    <CardBody className="space-y-3">
      <Notice tone="warning" title="ADMIN không duyệt hoặc xác nhận thay">
        Quản trị demo chỉ xem, thay BQL quản lý đang ngừng hoạt động, cấu hình và khôi phục dữ liệu demo. ADMIN không có quyền duyệt, xác nhận,
        nghiệm thu hay ký thay người nghiệp vụ.
      </Notice>
      <div className="relative overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Quyền theo vai trò</caption>
          <thead>
            <tr className="bg-surface-2">
              <th scope="col" className="border-b border-line px-3 py-2.5 text-xs font-semibold text-ink-2">
                Hành động
              </th>
              {MATRIX_ROLES.map((role) => (
                <th key={role} scope="col" className="border-b border-line px-3 py-2.5 text-center text-xs font-semibold text-ink-2">
                  {ROLE_LABEL[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_ROWS.map((row) => (
              <tr key={`${row.group}-${row.label}`} className="hover:bg-surface-2">
                <th scope="row" className="border-b border-line px-3 py-2 font-normal text-ink">
                  <span className="mr-1.5 text-xs text-ink-2">{row.group} ·</span>
                  {row.label}
                </th>
                {MATRIX_ROLES.map((role) => {
                  const allowed = isAllowed(row, role);
                  const note = row.notes?.[role];
                  return (
                    <td key={role} className="border-b border-line px-3 py-2 text-center">
                      {allowed ? (
                        <Check className="mx-auto h-4 w-4 text-good" aria-hidden />
                      ) : (
                        <Minus className="mx-auto h-4 w-4 text-ink-3" aria-hidden />
                      )}
                      <span className="sr-only">{allowed ? 'Được làm' : 'Không được làm'}</span>
                      {allowed && note ? <span className="block text-[11px] text-ink-2">{note}</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardBody>
  </Card>
);
