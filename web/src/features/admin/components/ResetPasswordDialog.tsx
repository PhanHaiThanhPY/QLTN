import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Notice } from '@/components/common/Notice';
import { PasswordInput } from '@/components/common/PasswordInput';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { ERROR_CODE, isAppError, toErrorMessage } from '@/domain/errors';
import type { User } from '@/domain/types';
import { passwordError } from '@/services/http/mappers';
import { resetUserPassword } from '@/services/http/users-api';

export const RESET_PASSWORD_MESSAGES = {
  MISMATCH: 'Mật khẩu nhập lại không khớp.',
  NOT_FOUND: 'Không tìm thấy tài khoản.',
} as const;

export const resetPasswordSuccessMessage = (code: string): string =>
  `Đã đặt lại mật khẩu cho «${code}». Hãy gửi mật khẩu mới cho nhân viên qua kênh an toàn.`;

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, 'Vui lòng nhập mật khẩu mới.')
      .superRefine((value, ctx) => {
        const issue = passwordError(value);
        if (issue) ctx.addIssue({ code: 'custom', message: issue });
      }),
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu mới.'),
  })
  .refine((values) => values.confirmPassword === values.password, {
    path: ['confirmPassword'],
    message: RESET_PASSWORD_MESSAGES.MISMATCH,
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

const EMPTY_VALUES: ResetPasswordValues = { password: '', confirmPassword: '' };
const FORM_ID = 'reset-password-form';

interface ResetPasswordDialogProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the backend accepted the new password (the history block reloads). */
  onReset: () => void;
}

/** Administrator sets a new password for another account (SPEC US-S1 §3.1); the employee is signed out everywhere. */
export const ResetPasswordDialog = ({ user, open, onOpenChange, onReset }: ResetPasswordDialogProps) => {
  const { register, handleSubmit, setError, reset, formState } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: EMPTY_VALUES,
  });
  const errors = formState.errors;

  const handleOpenChange = (next: boolean) => {
    if (!next) reset(EMPTY_VALUES);
    onOpenChange(next);
  };

  const onSubmit = async (values: ResetPasswordValues): Promise<void> => {
    try {
      await resetUserPassword(user.id, values.password);
    } catch (error) {
      console.error('Reset password failed:', isAppError(error) ? error.code : error);
      if (isAppError(error) && error.code === ERROR_CODE.NOT_FOUND) {
        toast.error(RESET_PASSWORD_MESSAGES.NOT_FOUND);
        return;
      }
      const fieldMessage = isAppError(error) ? error.fieldErrors?.password : undefined;
      if (fieldMessage) setError('password', { message: fieldMessage });
      else toast.error(toErrorMessage(error));
      return;
    }
    reset(EMPTY_VALUES);
    onOpenChange(false);
    toast.success(resetPasswordSuccessMessage(user.code));
    onReset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      size="sm"
      title="Đặt lại mật khẩu"
      footer={
        <>
          <Button variant="outline" disabled={formState.isSubmitting} onClick={() => handleOpenChange(false)}>
            Hủy
          </Button>
          <Button type="submit" form={FORM_ID} variant="danger" isLoading={formState.isSubmitting}>
            Đặt lại
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className="space-y-4" noValidate onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
        <Notice tone="warning">
          {`Nhân viên «${user.fullName} (${user.code})» sẽ bị đăng xuất khỏi mọi thiết bị và phải đăng nhập bằng mật khẩu mới.`}
        </Notice>
        <Field label="Mật khẩu mới" htmlFor="rp-new" required error={errors.password?.message}>
          <PasswordInput id="rp-new" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register('password')} />
        </Field>
        <Field label="Nhập lại mật khẩu mới" htmlFor="rp-confirm" required error={errors.confirmPassword?.message}>
          <PasswordInput
            id="rp-confirm"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </Field>
      </form>
    </Dialog>
  );
};
