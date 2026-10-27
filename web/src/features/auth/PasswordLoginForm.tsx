import { useState } from 'react';
import { useNavigate } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
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
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-accent">Đăng nhập hệ thống</p>
      <h1 className="text-[2rem] font-bold leading-tight tracking-[-0.04em] text-ink sm:text-[2.25rem]">Chào mừng trở lại</h1>
      <p className="mt-2 text-base leading-7 text-ink-2">Đăng nhập để quản lý vận hành tòa nhà</p>
      <form className="mt-8 space-y-5" noValidate onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
        <Field label="Email hoặc tên đăng nhập" htmlFor="login-username" required error={errors.username?.message}>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
            <Input
              id="login-username"
              autoComplete="username"
              autoFocus
              aria-invalid={Boolean(errors.username)}
              className="h-14 rounded-xl border-[#cfd9e6] bg-white pl-12 pr-4 text-base shadow-[0_6px_18px_-14px_rgb(15_42_68_/_0.5)]"
              {...register('username')}
            />
          </div>
        </Field>
        <Field label="Mật khẩu" htmlFor="login-password" required error={errors.password?.message}>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
            <Input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              className="h-14 rounded-xl border-[#cfd9e6] bg-white pl-12 pr-12 text-base shadow-[0_6px_18px_-14px_rgb(15_42_68_/_0.5)]"
              {...register('password')}
            />
            <button
              type="button"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-3 transition-colors hover:text-ink"
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
            </button>
          </div>
        </Field>
        <div className="flex items-center justify-between gap-4 text-sm">
          <label className="flex items-center gap-2 text-ink-2">
            <input type="checkbox" className="size-5 rounded border-[#c2cedc] accent-[#0ea5a8]" />
            Ghi nhớ đăng nhập
          </label>
          <span className="font-semibold text-accent">Quên mật khẩu?</span>
        </div>
        {formError ? (
          <Notice tone="danger" title="Không đăng nhập được" className="rounded-2xl px-4 py-3">
            {formError}
          </Notice>
        ) : null}
        <Button
          type="submit"
          size="lg"
          isLoading={formState.isSubmitting}
          className="h-14 w-full rounded-xl bg-[#0ea5a8] text-base font-bold shadow-[0_8px_18px_-10px_rgb(14_165_168_/_0.8)] hover:bg-[#0b9498]"
        >
          Đăng nhập
          <ArrowRight className="size-5" aria-hidden />
        </Button>
      </form>
      <div className="mt-8 flex items-center gap-4 text-xs text-ink-3">
        <span className="h-px flex-1 bg-[#dbe3ec]" aria-hidden />
        <span className="whitespace-nowrap">Cần tài khoản? Liên hệ quản trị viên</span>
        <span className="h-px flex-1 bg-[#dbe3ec]" aria-hidden />
      </div>
    </>
  );
};
