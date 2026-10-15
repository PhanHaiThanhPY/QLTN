import { Fragment } from 'react';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState, LoadingState } from '@/components/common/States';
import { forbidden } from '@/domain/errors';
import { hasCapability } from '@/domain/permissions';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getAdminOverview } from '@/services/admin-service';
import { AccountsCard } from './components/AccountsCard';
import { DepartmentsCard } from './components/DepartmentsCard';
import { DemoSettingsCard } from './components/DemoSettingsCard';
import { PermissionMatrixCard } from './components/PermissionMatrixCard';
import { RolesCard } from './components/RolesCard';
import { SeedResetCard } from './components/SeedResetCard';

export type AdminSection = 'employees' | 'departments' | 'roles';

const SECTION_INFO: Record<AdminSection, { title: string; description: string }> = {
  employees: { title: 'Nhân viên', description: 'Quản lý tài khoản, vai trò nghiệp vụ và phạm vi tòa nhà, vị trí được giao.' },
  departments: { title: 'Bộ phận', description: 'Quản lý các bộ phận và phạm vi tòa nhà được phép tham gia workflow.' },
  roles: { title: 'Vai trò & ma trận quyền', description: 'Quản lý vai trò tùy chỉnh và xem quyền thao tác theo từng vai trò hệ thống.' },
};

interface AdminSectionPageProps {
  section: AdminSection;
}

/** Shared data and access guard for the three administration menus. */
const AdminSectionPage = ({ section }: AdminSectionPageProps) => {
  const info = SECTION_INFO[section];
  const { data: reference, isLoading: isReferenceLoading, buildingCode } = useReferenceData();
  const viewer = reference?.viewer;
  const canView = Boolean(viewer && hasCapability(viewer, 'ADMIN_VIEW'));
  const query = useServiceQuery(['admin', 'overview'], getAdminOverview, canView);

  if (isReferenceLoading || !viewer) return <><PageHeader title={info.title} description={info.description} /><LoadingState rows={5} /></>;
  if (!canView) return <><PageHeader title={info.title} description={info.description} /><ErrorState error={forbidden('Chỉ ADMIN được vào trang quản trị demo.')} /></>;
  if (query.isLoading) return <><PageHeader title={info.title} description={info.description} /><LoadingState rows={5} /></>;
  if (query.error || !query.data) return <><PageHeader title={info.title} description={info.description} /><ErrorState error={query.error} onRetry={() => void query.refetch()} /></>;

  const overview = query.data;
  const commonNotice = (
    <Notice tone="warning" title="Giới hạn của ADMIN" className="rounded-lg px-3 py-2.5">
      ADMIN quản lý cấu hình và phân quyền, không duyệt, xác nhận, nghiệm thu hay ký thay người nghiệp vụ.
    </Notice>
  );

  return (
    <div className="space-y-5">
      <PageHeader title={info.title} description={info.description} />
      {commonNotice}
      {section === 'employees' ? <AccountsCard users={overview.users} departments={overview.departments} roles={overview.roles} buildings={reference.buildings} buildingCode={buildingCode} /> : null}
      {section === 'departments' ? <DepartmentsCard departments={overview.departments} users={overview.users} buildings={reference.buildings} buildingCode={buildingCode} /> : null}
      {section === 'roles' ? (
        <Fragment>
          <RolesCard roles={overview.roles} users={overview.users} />
          <PermissionMatrixCard />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DemoSettingsCard key={`${overview.settings.latencyMs}-${String(overview.settings.failNextCommand)}`} settings={overview.settings} />
            <SeedResetCard seedInfo={overview.seedInfo} counts={overview.counts} />
          </div>
        </Fragment>
      ) : null}
    </div>
  );
};

export default AdminSectionPage;
