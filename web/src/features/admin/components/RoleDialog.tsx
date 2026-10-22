import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ROLE_LABEL } from '@/domain/constants';
import { roleCapabilities } from '@/domain/permissions';
import type { Capability } from '@/domain/permissions';
import type { RoleDefinition } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { CAPABILITY_LABEL } from '../capability-labels';

interface RoleDialogProps {
  /** Role being copied/edited; create mode starts from a selected system role. */
  role?: RoleDefinition;
  systemRoles: RoleDefinition[];
  mode: 'create' | 'copy' | 'edit';
  onClose: () => void;
}

/** Copy a role into a new custom role, or edit a custom role; only permissions of the system role can be kept. */
export const RoleDialog = ({ role, systemRoles, mode, onClose }: RoleDialogProps) => {
  const initialRole = role ?? systemRoles[0];
  const [baseRoleId, setBaseRoleId] = useState(initialRole?.id ?? '');
  const selectedBaseRole = systemRoles.find((item) => item.id === baseRoleId) ?? initialRole;
  const [name, setName] = useState(mode === 'copy' && role ? `${role.name} (bản sao)` : role?.name ?? '');
  const [picked, setPicked] = useState<Capability[]>(role?.capabilities ?? (selectedBaseRole ? [...selectedBaseRole.capabilities] : []));
  const command = useCommand({ successMessage: mode === 'edit' ? 'Đã lưu vai trò.' : 'Đã tạo vai trò.', onSuccess: onClose });
  const allowed = selectedBaseRole ? roleCapabilities(selectedBaseRole.baseRole) : [];
  const toggle = (capability: Capability) =>
    setPicked((prev) => (prev.includes(capability) ? prev.filter((row) => row !== capability) : [...prev, capability]));
  const submit = () => {
    if (mode === 'edit' && role) {
      void command.execute({ subjectType: 'ACCOUNT', subjectId: role.id, expectedVersion: role.version, action: 'updateRoleDef', payload: { name, capabilities: picked } });
      return;
    }
    if (mode === 'copy' && role) {
      void command.execute({ subjectType: 'ACCOUNT', action: 'createRoleDef', payload: { sourceRoleId: role.id, name, capabilities: picked } });
      return;
    }
    void command.execute({ subjectType: 'ACCOUNT', action: 'createRoleDef', payload: { baseRole: selectedBaseRole?.baseRole, name, capabilities: picked } });
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={mode === 'create' ? 'Tạo vai trò tùy chỉnh' : mode === 'copy' && role ? `Sao chép vai trò ${role.name}` : `Sửa vai trò ${role?.name ?? ''}`}
      description="Vai trò tùy chỉnh dùng một vai trò gốc để xác định phạm vi quyền; bạn có thể giữ hoặc bỏ từng quyền, sau đó dùng vai trò này trong workflow."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} onClick={submit}>
            {mode === 'edit' ? 'Lưu' : 'Tạo vai trò'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mode === 'create' ? (
          <Field label="Vai trò gốc" htmlFor="role-base" required error={command.fieldErrors.baseRole}>
            <select id="role-base" className="h-9 w-full rounded-lg border border-line-2 bg-surface px-2.5 text-sm text-ink" value={baseRoleId} onChange={(event) => {
              setBaseRoleId(event.target.value);
              const next = systemRoles.find((item) => item.id === event.target.value);
              if (next) setPicked([...next.capabilities]);
            }}>
              {systemRoles.map((item) => <option key={item.id} value={item.id}>{ROLE_LABEL[item.baseRole]} · {item.code}</option>)}
            </select>
          </Field>
        ) : null}
        <Field label="Tên vai trò" htmlFor="role-name" required error={command.fieldErrors.name}>
          <Input id="role-name" maxLength={80} placeholder="VD: Kỹ thuật viên tòa nhà" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Quyền" error={command.fieldErrors.capabilities}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {allowed.map((capability) => (
              <label key={capability} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--accent)]"
                  checked={capability === 'VIEW' || picked.includes(capability)}
                  disabled={capability === 'VIEW'}
                  onChange={() => toggle(capability)}
                />
                {CAPABILITY_LABEL[capability]}
              </label>
            ))}
          </div>
        </Field>
      </div>
    </Dialog>
  );
};
