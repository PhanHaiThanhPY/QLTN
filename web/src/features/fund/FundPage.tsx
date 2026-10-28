import { useState } from 'react';
import { Link } from 'react-router';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { NativeSelect } from '@/components/ui/input';
import { hasCapability } from '@/domain/permissions';
import { useOnline } from '@/hooks/useOnline';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listContracts } from '@/services/exploitation-api';
import { getLedger, type LedgerCategory, type LedgerDirection } from '@/services/fund-api';
import { formatVndText } from '@/utils/money';
import { FigureRow } from '@/features/exploitation/components/FigureRow';
import { shortVnd } from '@/features/exploitation/contract-ui';
import { FundSetupForm } from './components/FundSetupForm';
import { FundToolbar } from './components/FundToolbar';
import { LedgerTable } from './components/LedgerTable';
import { PendingOpeningNotice } from './components/PendingOpeningNotice';
import { CATEGORY_TEXT, DIRECTION_TEXT, accountText, monthText } from './fund-ui';
import { useFundScope } from './useFundScope';

const CATEGORIES = Object.entries(CATEGORY_TEXT) as Array<[LedgerCategory, string]>;
const isCategory = (value: string): value is LedgerCategory => CATEGORIES.some(([key]) => key === value);
const isDirection = (value: string): value is LedgerDirection => value === 'IN' || value === 'OUT';

/** "Sổ quỹ khai thác" (SPEC F-S3 §3.1, ui-brief §2.1): one fund, one month, every figure "theo sổ". */
const FundPage = () => {
  const scope = useFundScope();
  const { data } = useReferenceData();
  const online = useOnline();
  const [filters, setFilters] = useState<{ category?: LedgerCategory; direction?: LedgerDirection }>({});
  const [editing, setEditing] = useState(false);
  const fund = scope.fund;
  const ledger = useServiceQuery(['fund', 'ledger', fund?.id, scope.month, filters], () =>
    fund ? getLedger(fund.id, scope.month, filters) : Promise.resolve(null),
  );
  const owed = useServiceQuery(['exploitation', 'contracts', 'owing', fund?.buildingId], () =>
    fund ? listContracts({ buildingId: fund.buildingId, owing: true }) : Promise.resolve(null),
  );
  if (scope.isLoading) return <LoadingState rows={4} />;
  if (scope.error) return <ErrorState error={scope.error} onRetry={scope.refetch} />;
  if (!fund || !data?.viewer) return <EmptyState title="Không có quỹ khai thác trong phạm vi của bạn." />;
  const canOperate = hasCapability(data.viewer, 'FUND_OPERATE');
  const canApprove = hasCapability(data.viewer, 'FUND_APPROVE');
  const header = (
    <PageHeader
      title="Sổ quỹ khai thác"
      description={
        fund.openingDate ? `Tài khoản ${accountText(fund)} · Số liệu theo sổ, chưa đối soát sao kê` : 'Quỹ chưa được thiết lập.'
      }
      actions={canOperate && fund.openingDate ? <Button variant="secondary" onClick={() => setEditing(true)}>Sửa thiết lập</Button> : null}
    />
  );

  if (!fund.openingDate) {
    return (
      <div className="space-y-4">
        {header}
        <FundToolbar scope={scope} />
        {canOperate ? (
          <Card>
            <CardHeader
              title="Thiết lập quỹ"
              description="Nhập tài khoản của quỹ và số dư theo sao kê tại đầu ngày bắt đầu sổ. Chưa có số dư đầu thì chưa ghi được chứng từ nào."
            />
            <CardBody className="pt-0">
              <FundSetupForm fund={fund} online={online} />
            </CardBody>
          </Card>
        ) : (
          <EmptyState title="Kế toán chưa thiết lập quỹ khai thác của tòa này." />
        )}
      </div>
    );
  }

  const figures = ledger.data?.figures;
  const body = () => {
    if (ledger.isLoading) return <LoadingState rows={3} />;
    if (ledger.error) return <ErrorState error={ledger.error} onRetry={() => void ledger.refetch()} />;
    if (!ledger.data || !figures) return <EmptyState title={`${monthText(scope.month)} trước ngày bắt đầu sổ.`} />;
    return <LedgerTable page={ledger.data} />;
  };
  return (
    <div className="space-y-4">
      {header}
      {online ? null : <Notice tone="warning">Đang mất kết nối — chưa ghi được chứng từ.</Notice>}
      <PendingOpeningNotice fund={fund} canApprove={canApprove} online={online} />
      <FundToolbar scope={scope} />
      <FigureRow
        figures={[
          { label: 'Đầu kỳ', value: figures ? shortVnd(figures.openingVnd) : '—' },
          { label: 'Thu', value: figures ? shortVnd(figures.inVnd) : '—' },
          { label: 'Chi', value: figures ? shortVnd(figures.outVnd) : '—' },
          { label: 'Cuối kỳ', value: figures ? shortVnd(figures.closingVnd) : '—', hint: 'theo sổ' },
        ]}
      />
      <div className="flex flex-col gap-1 text-sm text-ink-2 sm:flex-row sm:justify-between">
        <span>trong đó tiền cọc đang giữ: {formatVndText(figures?.depositHeldVnd ?? '0')}</span>
        <Link to="/exploitation/contracts?owing=1" className="text-accent hover:underline">
          Còn phải thu (theo dõi riêng): {formatVndText(owed.data?.counts.remainingVnd ?? '0')} ›
        </Link>
      </div>
      <Card>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:w-[32rem]">
            <Field label="Nhóm" htmlFor="lg-category">
              <NativeSelect
                id="lg-category"
                value={filters.category ?? ''}
                onChange={(event) => setFilters({ ...filters, category: isCategory(event.target.value) ? event.target.value : undefined })}
              >
                <option value="">Tất cả nhóm</option>
                {CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Thu / Chi" htmlFor="lg-direction">
              <NativeSelect
                id="lg-direction"
                value={filters.direction ?? ''}
                onChange={(event) => setFilters({ ...filters, direction: isDirection(event.target.value) ? event.target.value : undefined })}
              >
                <option value="">Thu và chi</option>
                <option value="IN">{DIRECTION_TEXT.IN}</option>
                <option value="OUT">{DIRECTION_TEXT.OUT}</option>
              </NativeSelect>
            </Field>
          </div>
          {body()}
        </CardBody>
      </Card>
      <Dialog open={editing} onOpenChange={setEditing} title="Sửa thiết lập quỹ" size="lg">
        <FundSetupForm fund={fund} online={online} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
      </Dialog>
    </div>
  );
};

export default FundPage;
