import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import type { Department, User } from '@/domain/types';
import type { Building } from '@/domain/types';
import { DepartmentDialog } from './DepartmentDialog';
import { useOpenFromQuery } from '../hooks/useOpenFromQuery';

interface DepartmentsCardProps {
  departments: Department[];
  users: User[];
  buildings: Building[];
  buildingCode: (id?: string) => string;
}

/** Organization units and building scope used before configuring workflow steps. */
export const DepartmentsCard = ({ departments, users, buildings, buildingCode }: DepartmentsCardProps) => {
  const [editing, setEditing] = useState<Department | 'new' | null>(null);
  useOpenFromQuery(departments, setEditing);
  const membersOf = (department: Department) => users.filter((user) => user.departmentId === department.id).length;
  const scopeOf = (department: Department) => department.buildingIds.length === buildings.length ? 'Tất cả tòa nhà' : `Tòa ${department.buildingIds.map((id) => buildingCode(id)).join(', ')}`;
  return (
    <Card>
      <CardHeader
        title="Bộ phận"
        description="Khai báo đơn vị chịu trách nhiệm để workflow có thể tìm đúng người theo bộ phận, vai trò và phạm vi tòa nhà."
        actions={<Button size="sm" onClick={() => setEditing('new')}><Plus className="h-4 w-4" />Thêm bộ phận</Button>}
      />
      <CardBody>
        <Table>
          <thead>
            <tr><Th>Mã</Th><Th>Tên bộ phận</Th><Th>Phạm vi</Th><Th>Nhân viên</Th><Th className="text-right">Thao tác</Th></tr>
          </thead>
          <tbody>
            {departments.map((department) => (
              <Tr key={department.id}>
                <Td className="font-medium">{department.code}</Td>
                <Td><span className="font-medium">{department.name}</span><span className="block text-xs text-ink-2">{department.description ?? '—'}</span></Td>
                <Td>{scopeOf(department)}</Td>
                <Td className="tnum">{membersOf(department)}</Td>
                <Td className="text-right"><Button size="xs" variant="ghost" onClick={() => setEditing(department)}>Sửa</Button></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <ul className="space-y-2 md:hidden">
          {departments.map((department) => (
            <li key={department.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-3">
              <span className="min-w-0"><span className="block font-medium text-ink">{department.name}</span><span className="block text-xs text-ink-2">{department.code} · {scopeOf(department)} · {membersOf(department)} nhân viên</span></span>
              <Button size="xs" variant="ghost" onClick={() => setEditing(department)}>Sửa</Button>
            </li>
          ))}
        </ul>
      </CardBody>
      {editing ? <DepartmentDialog department={editing === 'new' ? undefined : editing} buildings={buildings} onClose={() => setEditing(null)} /> : null}
    </Card>
  );
};
