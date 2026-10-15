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
  /** Role being copied (mode copy) or edited (mode edit, custom roles only). */
  role: RoleDefinition;
  mode: 'copy' | 'edit';
  onClose: () => void;
}

/** Copy a role into a new custom role, or edit a custom role; only permissions of the system role can be kept. */
export const RoleDialog = ({ role, mode, onClose }: RoleDialogProps) => {
  const [name, setName] = useState(mode === 'copy' ? `${role.name} (bản sao)` : role.name);
  const [picked, setPicked] = useState<Capability[]>(role.capabilities);
  const command = useCommand({ successMessage: mode === 'copy' ? 'Đã tạo vai trò.' : 'Đã lưu vai trò.', onSuccess: onClose });
  const allowed = roleCapabilities(role.baseRole);
  const toggle = (capability: Capability) =>
    setPicked((prev) => (prev.includes(capability) ? prev.filter((row) => row !== capability) : [...prev, capability]));
  const submit = () =>
    void command.execute(
      mode === 'copy'
        ? { subjectType: 'ACCOUNT', action: 'createRoleDef', payload: { sourceRoleId: role.id, name, capabilities: picked } }
        : { subjectType: 'ACCOUNT', subjectId: role.id, expectedVersion: role.version, action: 'updateRoleDef', payload: { name, capabilities: picked } },
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={mode === 'copy' ? `Sao chép vai trò ${role.name}` : `Sửa vai trò ${role.name}`}
      description={`Vai trò gốc: ${ROLE_LABEL[role.baseRole]}. Chỉ giữ hoặc bỏ quyền của vai trò gốc, không cấp thêm; người dùng không được sao chép theo.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} onClick={submit}>
            {mode === 'copy' ? 'Tạo vai trò' : 'Lưu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
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
