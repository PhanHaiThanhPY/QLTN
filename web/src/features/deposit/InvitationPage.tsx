import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { AuditTimeline } from '@/components/common/AuditTimeline';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { StatusPill } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { TabPanel, Tabs } from '@/components/ui/tabs';
import { ERROR_CODE, isAppError } from '@/domain/errors';
import { hasCapability } from '@/domain/permissions';
import { useCommand } from '@/hooks/useCommand';
import { useOnline } from '@/hooks/useOnline';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { cn } from '@/lib/cn';
import { getInvitation } from '@/services/deposit-api';
import { formatDate } from '@/utils/date';
import { FigureRow } from '@/features/exploitation/components/FigureRow';
import { shortVnd } from '@/features/exploitation/contract-ui';
import { formatVnDateTime } from '@/features/exploitation/exploitation-ui';
import { ComparisonCards } from './components/ComparisonCards';
import { InvitationActions } from './components/InvitationActions';
import { InvitationCard } from './components/InvitationCard';
import { OfferDialog } from './components/OfferDialog';
import { ResponsesCard } from './components/ResponsesCard';
import { ResultPanel } from './components/ResultPanel';
import { INVITATION_STATUS_TEXT, INVITATION_STATUS_TONE } from './deposit-ui';

const TABS = ['letter', 'compare', 'result', 'history'] as const;
type InvitationTab = (typeof TABS)[number];
const isTab = (value: string | null): value is InvitationTab => TABS.some((tab) => tab === value);

const NotFound = () => (
  <EmptyState
    title="Không tìm thấy thư mời"
    description="Thư mời không tồn tại hoặc nằm ngoài phạm vi của bạn."
    action={
      <Link to="/deposits/invitations" className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
        Về danh sách thư mời
      </Link>
    }
  />
);

/** "MC-001 · Thư mời chào lãi suất" (SPEC T-S1, ui-brief §2.2–2.3, D1 pp. 33–34): BQL acts, BQT decides, Kế toán reads. */
const InvitationPage = () => {
  const { invitationId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { data, buildingName } = useReferenceData();
  const online = useOnline();
  const query = useServiceQuery(['deposit', 'invitation', invitationId], () => getInvitation(invitationId));
  const command = useCommand({ successMessage: 'Đã cập nhật thư mời.' });
  const [offerId, setOfferId] = useState<string | null>(null);
  const tabParam = params.get('tab');
  const tab: InvitationTab = isTab(tabParam) ? tabParam : 'letter';

  useEffect(() => {
    if (query.data) document.title = `${query.data.invitation.code} · Thư mời chào lãi · QLTN`;
  }, [query.data]);

  if (query.isLoading) return <LoadingState rows={5} />;
  if (isAppError(query.error) && query.error.code === ERROR_CODE.NOT_FOUND) return <NotFound />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data || !data?.viewer) return <LoadingState rows={5} />;

  const detail = query.data;
  const { invitation } = detail;
  const viewer = data.viewer;
  const canManage = hasCapability(viewer, 'DEPOSIT_MANAGE');
  const setTab = (next: string) => {
    const updated = new URLSearchParams(params);
    updated.set('tab', next);
    setParams(updated, { replace: true });
  };
  const live = detail.selections.find((row) => row.status === 'APPROVED' || row.status === 'PENDING');
  const offer = detail.offers.find((row) => row.id === offerId);
  const editableOffers = canManage && online && (invitation.status === 'OPEN' || invitation.status === 'CLOSED');

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${invitation.code} · Thư mời chào lãi suất`}
        breadcrumbs={[{ label: 'Thư mời chào lãi', to: '/deposits/invitations' }, { label: invitation.code }]}
        description={`${buildingName(invitation.buildingId)} · Quỹ bảo trì${invitation.sentOn ? ` · gửi ${formatDate(invitation.sentOn)}` : ''}`}
        actions={
          <>
            <span className={invitation.status === 'CANCELLED' ? 'text-ink-3' : undefined}>
              <StatusPill tone={INVITATION_STATUS_TONE[invitation.status]}>{INVITATION_STATUS_TEXT[invitation.status]}</StatusPill>
            </span>
            {canManage ? <InvitationActions detail={detail} command={command} online={online} /> : null}
          </>
        }
      />
      {online ? null : <Notice tone="warning">Đang mất kết nối — chưa lưu được thay đổi.</Notice>}
      {command.errorCode === ERROR_CODE.CONFLICT ? (
        <Notice tone="warning">
          <span className="flex flex-wrap items-center gap-2">
            {command.errorMessage}
            <Button size="sm" variant="secondary" onClick={() => { command.reset(); void query.refetch(); }}>
              Tải lại
            </Button>
          </span>
        </Notice>
      ) : null}
      <FigureRow
        figures={[
          { label: 'Số tiền', value: shortVnd(invitation.amountVnd) },
          { label: 'Kỳ hạn', value: `${invitation.termDays} ngày` },
          { label: 'Hạn phản hồi', value: invitation.deadlineAt ? formatVnDateTime(invitation.deadlineAt) : '—' },
          { label: 'Đã phản hồi', value: `${detail.progress.responded}/${detail.progress.invited}` },
        ]}
      />
      <Tabs
        value={tab}
        onValueChange={setTab}
        items={[
          { value: 'letter', label: 'Thư mời & phản hồi' },
          { value: 'compare', label: `So sánh bản chào${detail.offers.length ? ` ${detail.offers.length}` : ''}` },
          { value: 'result', label: 'Kết quả' },
          { value: 'history', label: 'Lịch sử' },
        ]}
      >
        <TabPanel value="letter">
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <InvitationCard detail={detail} />
            <ResponsesCard detail={detail} onOpenOffer={setOfferId} />
          </div>
        </TabPanel>
        <TabPanel value="compare">
          <Card>
            <CardBody>
              <ComparisonCards
                rows={detail.comparison.rows}
                amountVnd={detail.comparison.amountVnd}
                termDays={detail.comparison.termDays}
                mixedBasis={detail.comparison.mixedBasis}
                selectedOfferId={live?.offerId ?? null}
              />
            </CardBody>
          </Card>
        </TabPanel>
        <TabPanel value="result">
          <ResultPanel
            detail={detail}
            roles={{ manage: canManage, approve: hasCapability(viewer, 'DEPOSIT_APPROVE'), viewerId: viewer.id, writable: online }}
          />
        </TabPanel>
        <TabPanel value="history">
          <Card>
            <CardBody>
              <AuditTimeline events={detail.audit} />
            </CardBody>
          </Card>
        </TabPanel>
      </Tabs>
      {offer ? <OfferDialog detail={detail} offer={offer} canEdit={editableOffers} onClose={() => setOfferId(null)} /> : null}
    </div>
  );
};

export default InvitationPage;
