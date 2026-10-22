import type { ReactNode } from 'react';
import { BrandMark } from '@/components/layout/SidebarBrand';
import { LoginHero } from './LoginHero';

/** Shared split layout of the login screen: illustration on the left, sign-in panel on the right. */
export const LoginShell = ({ children }: { children: ReactNode }) => (
  <div className="relative grid min-h-dvh overflow-hidden bg-bg lg:h-dvh lg:grid-cols-[minmax(0,1.15fr)_minmax(30rem,0.85fr)]">
    <LoginHero />
    <section className="login-side-surface relative flex min-w-0 items-start justify-center overflow-y-auto border-line px-5 py-8 sm:px-8 lg:items-center lg:border-l lg:px-10">
      <div className="relative z-10 w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-3 lg:hidden">
          <BrandMark className="size-10" />
          <p className="text-base font-bold tracking-tight text-ink">QLTN · Sửa chữa & Bảo trì</p>
        </div>
        {children}
      </div>
    </section>
  </div>
);
