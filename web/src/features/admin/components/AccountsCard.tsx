import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { ROLE_LABEL } from '@/domain/constants';
import type { Building, Department, RoleDefinition, User } from '@/domain/types';
import { UserDialog } from './UserDialog';
import { useOpenFromQuery } from '../hooks/useOpenFromQuery';

interface AccountsCardProps {
  users: User[];
  departments: Department[];
  roles: RoleDefinition[];
  buildings: Building[];
  buildingCode: (id?: string) => string;
}

/** Employee directory: role, department and operational scope used by workflow rules. */
export const AccountsCard = ({ users, departments, roles, buildings, buildingCode }: AccountsCardProps) => {
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  useOpenFromQuery(users, setEditing);
  const [query, setQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const roleName = (user: User) => roles.find((role) => role.id === user.roleDefId)?.name ?? ROLE_LABEL[user.role];
  const departmentName = (user: User) => departments.find((department) => department.id === user.departmentId)?.name ?? 'Chưa gán bộ phận';
  const buildingsOf = (user: User) => `Tòa ${user.buildingIds.map((id) => buildingCode(id)).join(', ')}`;
  const systemRoles = useMemo(() => roles.filter((role) => role.isSystem), [roles]);
  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery = !normalized || [user.code, user.fullName, user.jobTitle, user.email, user.phone].some((value) => value?.toLowerCase().includes(normalized));
      const matchesDepartment = !departmentFilter || user.departmentId === departmentFilter;
      const matchesRole = !roleFilter || user.role === roleFilter;
      const matchesBuilding = !buildingFilter || user.buildingIds.includes(buildingFilter);
      return matchesQuery && matchesDepartment && matchesRole && matchesBuilding;
    });
  }, [buildingFilter, departmentFilter, query, roleFilter, users]);
  return (
    <Card>
      <CardHeader
        title="Tài khoản"
        description="Danh sách nhân viên, bộ phận, vai trò và phạm vi tòa nhà được dùng để phân công công việc."
        actions={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            Thêm tài khoản
          </Button>
        }
      />
      <CardBody>
        <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-4">
          <Input aria-label="Tìm nhân viên" placeholder="Tìm mã, họ tên, chức danh..." value={query} onChange={(event) => setQuery(event.target.value)} />
          <NativeSelect aria-label="Lọc bộ phận" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
            <option value="">Tất cả bộ phận</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Lọc vai trò" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">Tất cả vai trò</option>
            {systemRoles.map((role) => <option key={role.baseRole} value={role.baseRole}>{role.name}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Lọc tòa nhà" value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}>
            <option value="">Tất cả tòa nhà</option>
            {buildings.map((building) => <option key={building.id} value={building.id}>Tòa {building.code}</option>)}
          </NativeSelect>
        </div>
        <p className="mb-2 text-xs text-ink-2">Hiển thị {filteredUsers.length}/{users.length} nhân viên</p>
        <Table>
          <thead>
            <tr>
              <Th>Mã</Th>
              <Th>Họ tên</Th>
              <Th>Bộ phận</Th>
              <Th>Vai trò</Th>
              <Th>Tòa nhà</Th>
              <Th className="text-right">Thao tác</Th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <Tr key={user.id}>
                <Td className="font-medium">{user.code}</Td>
                <Td>{user.fullName}</Td>
                <Td>{departmentName(user)}</Td>
                <Td>{roleName(user)}</Td>
                <Td className="text-ink-2">{buildingsOf(user)}</Td>
                <Td className="text-right">
                  {user.role === 'ADMIN' ? null : (
                    <Button size="xs" variant="ghost" onClick={() => setEditing(user)}>
                      Sửa
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <ul className="space-y-2 md:hidden">
          {filteredUsers.map((user) => (
            <li key={user.id} className="rounded-lg border border-line px-3.5 py-3">
              <span className="font-medium text-ink">{user.code}</span>
              <span className="mt-1 block text-sm text-ink">{user.fullName}</span>
              <span className="block text-xs text-ink-2">
                {departmentName(user)} · {roleName(user)} · {buildingsOf(user)}
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
      {editing ? <UserDialog user={editing === 'new' ? undefined : editing} departments={departments} roles={roles} onClose={() => setEditing(null)} /> : null}
    </Card>
  );
};
