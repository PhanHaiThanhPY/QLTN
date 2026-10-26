import { useNavigate } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { PasswordInput } from '@/components/common/PasswordInput';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { ERROR_CODE, isAppError, toErrorMessage } from '@/domain/errors';
import { changeOwnPassword } from '@/services/http/auth-api';
import { useSessionStore } from '@/store/session-store';

/** Same bounds as api-qltn `PASSWORD_MIN` / `PASSWORD_MAX` (SPEC AU-S1 BR-01). */
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;
const CURRENT_PASSWORD_MAX = 200;

export const CHANGE_PASSWORD_MESSAGES = {
  SUCCESS: 'Đã đổi mật khẩu. Vui lòng đăng nhập lại bằng mật khẩu mới.',
  RATE_LIMITED: 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.',
  LENGTH: `Mật khẩu mới phải từ ${PASSWORD_MIN} đến ${PASSWORD_MAX} ký tự.`,
  MISMATCH: 'Mật khẩu nhập lại không khớp.',
  SAME_AS_CURRENT: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
} as const;

const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Vui lòng nhập mật khẩu hiện tại.')
      .max(CURRENT_PASSWORD_MAX, `Mật khẩu hiện tại tối đa ${CURRENT_PASSWORD_MAX} ký tự.`),
    newPassword: z
      .string()
      .min(1, 'Vui lòng nhập mật khẩu mới.')
      .refine((value) => value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX, CHANGE_PASSWORD_MESSAGES.LENGTH),
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu mới.'),
  })
  .refine((values) => values.confirmPassword === values.newPassword, {
    path: ['confirmPassword'],
    message: CHANGE_PASSWORD_MESSAGES.MISMATCH,
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    path: ['newPassword'],
    message: CHANGE_PASSWORD_MESSAGES.SAME_AS_CURRENT,
  });

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

const EMPTY_VALUES: ChangePasswordValues = { currentPassword: '', newPassword: '', confirmPassword: '' };
const API_FIELDS = ['currentPassword', 'newPassword'] as const;
const FORM_ID = 'change-password-form';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Change one's own password (api mode only, SPEC AU-S1). On success the backend signs every session out, so the
 * local session is dropped and the user goes back to `/login`; on failure the form stays open with its values.
 */
export const ChangePasswordDialog = ({ open, onOpenChange }: ChangePasswordDialogProps) => {
  const navigate = useNavigate();
  const signOut = useSessionStore((state) => state.signOut);
  const { register, handleSubmit, setError, reset, formState } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY_VALUES,
  });
  const errors = formState.errors;

  const handleOpenChange = (next: boolean) => {
    if (!next) reset(EMPTY_VALUES);
    onOpenChange(next);
  };

  const onSubmit = async (values: ChangePasswordValues): Promise<void> => {
    try {
      await changeOwnPassword(values.currentPassword, values.newPassword);
    } catch (error) {
      console.error('Change password failed:', isAppError(error) ? error.code : error);
      if (isAppError(error) && error.code === ERROR_CODE.RATE_LIMITED) {
        toast.error(CHANGE_PASSWORD_MESSAGES.RATE_LIMITED);
        return;
      }
      const fieldErrors = isAppError(error) ? error.fieldErrors : undefined;
      const matched = API_FIELDS.filter((field) => fieldErrors?.[field]);
      for (const field of matched) setError(field, { message: fieldErrors?.[field] });
      if (matched.length === 0) toast.error(toErrorMessage(error));
      return;
    }
    reset(EMPTY_VALUES);
    onOpenChange(false);
    await signOut();
    navigate('/login', { replace: true });
    toast.success(CHANGE_PASSWORD_MESSAGES.SUCCESS);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      size="sm"
      title="Đổi mật khẩu"
      description="Sau khi đổi, mọi phiên đăng nhập của tài khoản sẽ bị đăng xuất."
      footer={
        <>
          <Button variant="outline" disabled={formState.isSubmitting} onClick={() => handleOpenChange(false)}>
            Hủy
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={formState.isSubmitting}>
            Lưu
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className="space-y-4" noValidate onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
        <Field label="Mật khẩu hiện tại" htmlFor="cp-current" required error={errors.currentPassword?.message}>
          <PasswordInput
            id="cp-current"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.currentPassword)}
            {...register('currentPassword')}
          />
        </Field>
        <Field label="Mật khẩu mới" htmlFor="cp-new" required error={errors.newPassword?.message}>
          <PasswordInput
            id="cp-new"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.newPassword)}
            {...register('newPassword')}
          />
        </Field>
        <Field label="Nhập lại mật khẩu mới" htmlFor="cp-confirm" required error={errors.confirmPassword?.message}>
          <PasswordInput
            id="cp-confirm"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </Field>
      </form>
    </Dialog>
  );
};
