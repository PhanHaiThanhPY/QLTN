import { BrandMark } from '@/components/layout/SidebarBrand';

/** Reference image panel for the desktop login experience. */
export const LoginHero = () => (
  <section className="login-hero-surface relative hidden min-h-0 overflow-hidden lg:block">
    <img
      src="/images/login-hero.png"
      alt="Vận hành tòa nhà trong tầm kiểm soát"
      className="absolute inset-0 size-full object-cover object-left"
    />
    <div className="absolute inset-0 bg-gradient-to-b from-[#061a2d]/15 via-transparent to-[#061a2d]/20" aria-hidden />
    <div className="absolute left-8 top-8 flex items-center gap-3 rounded-2xl border border-white/15 bg-[#06223a]/45 px-3 py-2 text-white shadow-lg backdrop-blur-sm xl:left-10 xl:top-10">
      <BrandMark className="size-10" />
      <div className="leading-tight">
        <p className="text-base font-bold tracking-tight">QLTN</p>
        <p className="text-xs text-white/75">Vận hành tòa nhà</p>
      </div>
    </div>
  </section>
);
