import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ErrorState, LoadingState } from '@/components/common/States';
import { Notice } from '@/components/common/Notice';
import { BrandMark } from '@/components/layout/SidebarBrand';
import type { User } from '@/domain/types';
import { listDemoAccounts } from '@/services/reference-service';
import { useSessionStore } from '@/store/session-store';
import { AccountCard } from './AccountCard';
import { LoginHero } from './LoginHero';

/** "Vào demo": choose a seeded account. This is a simulated login, not authentication. */
const LoginPage = () => {
  const navigate = useNavigate();
  const signIn = useSessionStore((state) => state.signIn);
  const accounts = useQuery({ queryKey: ['demo-accounts'], queryFn: listDemoAccounts });

  const handleSelect = (user: User) => {
    if (!user.active) return;
    signIn(user.id);
    navigate('/', { replace: true });
  };

  return (
    <div className="relative grid min-h-dvh overflow-hidden bg-bg lg:h-dvh lg:grid-cols-[minmax(0,1.15fr)_minmax(30rem,0.85fr)]">
      <LoginHero />
      <section className="login-side-surface relative flex min-w-0 items-start justify-center overflow-y-auto border-line px-5 py-8 sm:px-8 lg:items-center lg:border-l lg:px-10">
        <div className="relative z-10 w-full max-w-2xl">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <BrandMark className="size-10" />
            <p className="text-base font-bold tracking-tight text-ink">QLTN · Sửa chữa & Bảo trì</p>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-accent">Truy cập bản demo</p>
              <h1 className="text-[1.85rem] font-bold leading-tight tracking-[-0.03em] text-ink sm:text-[2rem]">Chọn tài khoản để bắt đầu</h1>
            </div>
            <span className="hidden shrink-0 rounded-full border border-accent/20 bg-white px-3 py-1.5 text-xs font-bold text-accent shadow-card sm:inline-flex">4 tài khoản</span>
          </div>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink-2">Mỗi tài khoản đại diện một vai trò và phạm vi tòa nhà. Bạn có thể đổi tài khoản bất cứ lúc nào.</p>
          <Notice tone="warning" title="Đăng nhập mô phỏng" className="mt-5 rounded-2xl px-5 py-4">
            Không phải đăng nhập bảo mật. Dữ liệu demo chỉ lưu trong trình duyệt này và không mất khi đổi tài khoản.
          </Notice>
          <div className="mt-5">
            {accounts.isLoading ? <LoadingState rows={6} /> : null}
            {accounts.error ? <ErrorState error={accounts.error} onRetry={() => void accounts.refetch()} /> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {(accounts.data ?? []).map((user) => (
                <AccountCard key={user.id} user={user} onSelect={handleSelect} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LoginPage;
