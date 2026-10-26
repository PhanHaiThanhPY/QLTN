import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { IS_API_MODE } from '@/config/data-source';
import { hasCapability } from '@/domain/permissions';
import type { Department, RoleDefinition, User } from '@/domain/types';
import { useCommand } from '@/hooks/useCommand';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useReferenceData } from '@/hooks/useReferenceData';
import { PASSWORD_LIMITS, passwordError } from '@/services/http/mappers';
import { AccountHistory, accountHistoryKey } from './AccountHistory';
import { ResetPasswordDialog } from './ResetPasswordDialog';

interface UserDialogProps {
  user?: User;
  departments: Department[];
  roles: RoleDefinition[];
  onClose: () => void;
}

const roleIdOf = (user: User | undefined, roles: RoleDefinition[]): string =>
  user?.roleDefId ?? roles.find((role) => role.isSystem && role.baseRole === user?.role)?.id ?? '';

/** Create or edit an employee; scope stays within the administrator's assigned buildings. */
export const UserDialog = ({ user, departments, roles, onClose }: UserDialogProps) => {
  const { data } = useReferenceData();
  const viewer = useCurrentUser();
  const queryClient = useQueryClient();
  const [isResetting, setIsResetting] = useState(false);
  const [code, setCode] = useState(user?.code ?? '');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [departmentId, setDepartmentId] = useState(user?.departmentId ?? '');
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [roleDefId, setRoleDefId] = useState(roleIdOf(user, roles));
  const [buildingIds, setBuildingIds] = useState<string[]>(user?.buildingIds ?? []);
  const [locationIds, setLocationIds] = useState<string[]>(user?.locationIds ?? []);
  // api-qltn requires a password when creating an account; the demo (mock) account has none.
  const [password, setPassword] = useState('');
  const [passwordIssue, setPasswordIssue] = useState<string>();
  const command = useCommand({ successMessage: user ? 'Đã lưu tài khoản.' : 'Đã tạo tài khoản.', onSuccess: onClose });
  const errors = command.fieldErrors;
  // An existing account keeps its system role; only roles derived from it are offered.
  const choices = user ? roles.filter((role) => role.baseRole === user.role) : roles.filter((role) => role.baseRole !== 'ADMIN');
  const buildings = data?.buildings ?? [];
  const departmentsInScope = departments.filter((department) => department.buildingIds.length === 0 || buildingIds.every((id) => department.buildingIds.includes(id)));
  const locations = (data?.locations ?? []).filter((location) => buildingIds.includes(location.buildingId));
  const toggleBuilding = (id: string) => {
    const removing = buildingIds.includes(id);
    setBuildingIds((prev) => (removing ? prev.filter((row) => row !== id) : [...prev, id]));
    if (removing) setLocationIds((prev) => prev.filter((locationId) => data?.locations.some((location) => location.id === locationId && location.buildingId !== id) ?? true));
  };
  const toggleLocation = (id: string) => setLocationIds((prev) => (prev.includes(id) ? prev.filter((row) => row !== id) : [...prev, id]));
  const createsWithPassword = !user && IS_API_MODE;
  // US-S1: api mode only, on an existing account; a reset never targets the signed-in account (BR-04).
  const viewerCan = (capability: 'ACCOUNT_MANAGE' | 'ADMIN_VIEW'): boolean => Boolean(viewer && hasCapability(viewer, capability));
  const isOtherAccount = Boolean(user && viewer && user.id !== viewer.id);
  const canResetPassword = IS_API_MODE && isOtherAccount && viewerCan('ACCOUNT_MANAGE');
  const canSeeHistory = IS_API_MODE && Boolean(user) && viewerCan('ADMIN_VIEW');
  const submit = () => {
    if (createsWithPassword) {
      const issue = passwordError(password);
      setPasswordIssue(issue);
      if (issue) return;
    }
    const passwordField = createsWithPassword ? { password } : {};
    const usernameField = username.trim() || undefined;
    void command.execute(
      user
        ? { subjectType: 'ACCOUNT', subjectId: user.id, expectedVersion: user.version, action: 'updateUser', payload: { fullName, departmentId, jobTitle, email, phone, roleDefId, buildingIds, locationIds } }
        : { subjectType: 'ACCOUNT', action: 'createUser', payload: { code, username: usernameField, fullName, departmentId, jobTitle, email, phone, roleDefId, buildingIds, locationIds, ...passwordField } },
    );
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={user ? `Sửa tài khoản ${user.code}` : 'Thêm tài khoản'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button isLoading={command.isPending} onClick={submit}>
            {user ? 'Lưu' : 'Tạo tài khoản'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Mã tài khoản" htmlFor="usr-code" required error={errors.code} hint={user ? 'Không đổi sau khi tạo.' : 'VD: BQL-C'}>
          <Input id="usr-code" maxLength={20} placeholder="VD: BQL-A" value={code} disabled={Boolean(user)} onChange={(event) => setCode(event.target.value.toUpperCase())} />
        </Field>
        <Field label="Họ tên" htmlFor="usr-name" required error={errors.fullName}>
          <Input id="usr-name" maxLength={80} placeholder="VD: Nguyễn Văn A" value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </Field>
        {user ? null : (
          <Field
            label="Tên đăng nhập"
            htmlFor="usr-username"
            error={errors.username}
            hint={username.trim() ? 'Đăng nhập không phân biệt hoa thường.' : 'Bỏ trống để dùng mã tài khoản viết thường.'}
          >
            <Input
              id="usr-username"
              maxLength={50}
              placeholder="VD: bql-a"
              autoComplete="off"
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
            />
          </Field>
        )}
        {createsWithPassword ? (
          <Field
            label="Mật khẩu ban đầu"
            htmlFor="usr-password"
            required
            error={passwordIssue ?? errors.password}
            hint={`${PASSWORD_LIMITS.MIN}–${PASSWORD_LIMITS.MAX} ký tự; người dùng nên đổi sau lần đăng nhập đầu.`}
          >
            <Input
              id="usr-password"
              type="password"
              autoComplete="new-password"
              minLength={PASSWORD_LIMITS.MIN}
              maxLength={PASSWORD_LIMITS.MAX}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordIssue(undefined);
              }}
            />
          </Field>
        ) : null}
        <Field label="Bộ phận" htmlFor="usr-department" required error={errors.departmentId}>
          <NativeSelect id="usr-department" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
            <option value="">— Chọn bộ phận —</option>
            {departmentsInScope.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Chức danh" htmlFor="usr-title" error={errors.jobTitle}>
          <Input id="usr-title" maxLength={80} placeholder="VD: Kỹ thuật viên" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
        </Field>
        <Field label="Email" htmlFor="usr-email" error={errors.email}>
          <Input id="usr-email" type="email" maxLength={120} placeholder="VD: nguyenvana@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Số điện thoại" htmlFor="usr-phone" error={errors.phone}>
          <Input id="usr-phone" maxLength={20} placeholder="VD: 0901 234 567" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
        <Field label="Vai trò" htmlFor="usr-role" required error={errors.roleDefId} className="sm:col-span-2">
          <NativeSelect id="usr-role" value={roleDefId} onChange={(event) => setRoleDefId(event.target.value)}>
            <option value="">— Chọn vai trò —</option>
            {choices.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Tòa nhà được giao" required error={errors.buildingIds} className="sm:col-span-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {buildings.map((building) => (
              <label key={building.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink">
                <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={buildingIds.includes(building.id)} onChange={() => toggleBuilding(building.id)} />
                {building.name}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Khu vực được giao" error={errors.locationIds} className="sm:col-span-2" hint="Bỏ trống nếu nhân viên được phép xử lý mọi khu vực trong tòa nhà.">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {locations.map((location) => (
              <label key={location.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink">
                <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={locationIds.includes(location.id)} onChange={() => toggleLocation(location.id)} />
                {location.name} <span className="text-ink-3">· Tầng {location.floor}</span>
              </label>
            ))}
          </div>
        </Field>
      </div>
      {user && (canResetPassword || canSeeHistory) ? (
        <div className="mt-5 space-y-3 border-t border-line pt-4">
          {canResetPassword ? (
            <>
              <Button variant="outline" onClick={() => setIsResetting(true)}>
                <KeyRound />
                Đặt lại mật khẩu
              </Button>
              <ResetPasswordDialog
                user={user}
                open={isResetting}
                onOpenChange={setIsResetting}
                onReset={() => void queryClient.invalidateQueries({ queryKey: accountHistoryKey(user.id) })}
              />
            </>
          ) : null}
          {canSeeHistory ? <AccountHistory subjectId={user.id} /> : null}
        </div>
      ) : null}
    </Dialog>
  );
};
