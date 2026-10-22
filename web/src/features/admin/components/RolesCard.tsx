import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { ROLE_LABEL } from '@/domain/constants';
import type { RoleDefinition, User } from '@/domain/types';
import { RoleDialog } from './RoleDialog';

interface RolesCardProps {
  roles: RoleDefinition[];
  users: User[];
}

interface Editing {
  role?: RoleDefinition;
  mode: 'create' | 'copy' | 'edit';
}

/** System roles (fixed) and custom roles copied from them, with how many accounts hold each. */
export const RolesCard = ({ roles, users }: RolesCardProps) => {
  const [editing, setEditing] = useState<Editing | null>(null);
  const systemRoles = roles.filter((role) => role.isSystem);
  const holders = (role: RoleDefinition) =>
    users.filter((user) => (role.isSystem ? user.role === role.baseRole && !user.roleDefId : user.roleDefId === role.id)).length;
  return (
    <Card>
      <CardHeader title="Vai trò" description="Khách hàng có thể tạo vai trò mới, chọn vai trò gốc và quyền được phép; vai trò hệ thống không sửa được." actions={<Button size="sm" onClick={() => setEditing({ mode: 'create' })}><Plus /> Tạo vai trò</Button>} />
      <CardBody>
        <Table>
          <thead>
            <tr>
              <Th>Mã</Th>
              <Th>Tên vai trò</Th>
              <Th>Vai trò gốc</Th>
              <Th>Số quyền</Th>
              <Th>Tài khoản</Th>
              <Th className="text-right">Thao tác</Th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <Tr key={role.id}>
                <Td className="font-medium">{role.code}</Td>
                <Td>
                  {role.name} {role.isSystem ? <Badge tone="neutral">Hệ thống</Badge> : null}
                </Td>
                <Td>{ROLE_LABEL[role.baseRole]}</Td>
                <Td className="tnum">{role.capabilities.length}</Td>
                <Td className="tnum">{holders(role)}</Td>
                <Td className="text-right">
                  <span className="inline-flex gap-1">
                    {role.isSystem ? null : (
                      <Button size="xs" variant="ghost" onClick={() => setEditing({ role, mode: 'edit' })}>
                        Sửa
                      </Button>
                    )}
                    <Button size="xs" variant="ghost" onClick={() => setEditing({ role, mode: 'copy' })}>
                      Sao chép
                    </Button>
                  </span>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <ul className="space-y-2 md:hidden">
          {roles.map((role) => (
            <li key={role.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3.5 py-3">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{role.name}</span>
                <span className="block text-xs text-ink-2">
                  {ROLE_LABEL[role.baseRole]} · {role.capabilities.length} quyền · {holders(role)} tài khoản
                </span>
              </span>
              <Button size="xs" variant="ghost" onClick={() => setEditing({ role, mode: 'copy' })}>
                Sao chép
              </Button>
            </li>
          ))}
        </ul>
      </CardBody>
      {editing ? <RoleDialog role={editing.role} systemRoles={systemRoles} mode={editing.mode} onClose={() => setEditing(null)} /> : null}
    </Card>
  );
};
