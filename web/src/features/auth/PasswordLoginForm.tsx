import { useState } from 'react';
import { useNavigate } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Notice } from '@/components/common/Notice';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { isAppError, toErrorMessage } from '@/domain/errors';
import { useSessionStore } from '@/store/session-store';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Vui lòng nhập tên đăng nhập.').max(100, 'Tên đăng nhập tối đa 100 ký tự.'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.').max(200, 'Mật khẩu tối đa 200 ký tự.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

/** Real sign-in against api-qltn (`POST /auth/login`); backend messages show under the form. */
export const PasswordLoginForm = () => {
  const navigate = useNavigate();
  const signInWithPassword = useSessionStore((state) => state.signInWithPassword);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });
  const errors = formState.errors;

  const onSubmit = async (values: LoginFormValues): Promise<void> => {
    setFormError(null);
    try {
      await signInWithPassword(values.username, values.password);
      navigate('/', { replace: true });
    } catch (error) {
      if (isAppError(error) && error.fieldErrors) {
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          if (field === 'username' || field === 'password') setError(field, { message });
        }
      }
      setFormError(toErrorMessage(error));
    }
  };

  return (
    <>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-accent">Đăng nhập hệ thống</p>
      <h1 className="text-[1.85rem] font-bold leading-tight tracking-[-0.03em] text-ink sm:text-[2rem]">Đăng nhập để tiếp tục</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-ink-2">
        Dùng tài khoản được cấp trên hệ thống QLTN. Phiên đăng nhập được giữ trên trình duyệt này.
      </p>
      <form className="mt-6 max-w-md space-y-4" noValidate onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
        <Field label="Tên đăng nhập" htmlFor="login-username" required error={errors.username?.message}>
          <Input
            id="login-username"
            autoComplete="username"
            autoFocus
            aria-invalid={Boolean(errors.username)}
            {...register('username')}
          />
        </Field>
        <Field label="Mật khẩu" htmlFor="login-password" required error={errors.password?.message}>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </Field>
        {formError ? (
          <Notice tone="danger" title="Không đăng nhập được" className="rounded-2xl px-4 py-3">
            {formError}
          </Notice>
        ) : null}
        <Button type="submit" size="lg" isLoading={formState.isSubmitting} className="w-full sm:w-auto">
          Đăng nhập
        </Button>
      </form>
    </>
  );
};
