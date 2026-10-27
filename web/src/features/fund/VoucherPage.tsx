import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { AttachmentList } from '@/components/common/AttachmentList';
import { AuditTimeline } from '@/components/common/AuditTimeline';
import { InfoGrid } from '@/components/common/InfoGrid';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { StatusPill } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { DetailHeaderCard } from '@/features/maintenance/components/DetailHeaderCard';
import { ERROR_CODE, isAppError } from '@/domain/errors';
import { hasCapability } from '@/domain/permissions';
import { useCommand } from '@/hooks/useCommand';
import { useOnline } from '@/hooks/useOnline';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { cn } from '@/lib/cn';
import { getVoucher } from '@/services/fund-api';
import { formatDate, formatDateTime } from '@/utils/date';
import { formatVndText } from '@/utils/money';
import { Spoken } from './components/Spoken';
import { VoucherActions } from './components/VoucherActions';
import { DECISION_TEXT, TARGET_FUND_TEXT, VOUCHER_CATEGORY_TEXT, VOUCHER_STATUS_TEXT, VOUCHER_STATUS_TONE, spokenVnd } from './fund-ui';

/** A payment voucher (SPEC F-S3 BR-F3-12, ui-brief §2.4): details, request file, decisions, actions by role. */
const VoucherPage = () => {
  const { voucherId = '' } = useParams();
  const { data, buildingName, userName } = useReferenceData();
  const query = useServiceQuery(['fund', 'voucher', voucherId], () => getVoucher(voucherId));
  const command = useCommand({ successMessage: 'Đã cập nhật phiếu chi.' });
  const online = useOnline();

  useEffect(() => {
    if (query.data) document.title = `${query.data.voucher.code} · Phiếu chi · QLTN`;
  }, [query.data]);

  if (query.isLoading) return <LoadingState rows={4} />;
  if (isAppError(query.error) && query.error.code === ERROR_CODE.FORBIDDEN) return <EmptyState title="Bạn không có quyền xem phiếu chi." />;
  if (isAppError(query.error) && query.error.code === ERROR_CODE.NOT_FOUND)
    return (
      <EmptyState
        title="Không tìm thấy"
        description="Phiếu chi không tồn tại hoặc nằm ngoài phạm vi của bạn."
        action={
          <Link to="/exploitation/vouchers" className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
            Về danh sách phiếu chi
          </Link>
        }
      />
    );
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data || !data?.viewer) return <LoadingState rows={4} />;
  const { voucher, files, decisions, audit } = query.data;
  const requestFile = files[voucher.requestAttachmentId] ?? null;
  const proofFile = voucher.proofAttachmentId ? files[voucher.proofAttachmentId] : undefined;
  return (
    <div className="space-y-4">
      <PageHeader isCompact title={`${voucher.code} · Phiếu chi`} breadcrumbs={[{ label: 'Phiếu chi', to: `/exploitation/vouchers?building=${voucher.buildingId}` }, { label: voucher.code }]} />
      <DetailHeaderCard
        code={voucher.code}
        title={voucher.content}
        badges={<StatusPill tone={VOUCHER_STATUS_TONE[voucher.status]}>{`${voucher.status === 'PAID' ? '✓ ' : ''}${VOUCHER_STATUS_TEXT[voucher.status]}`}</StatusPill>}
        meta={`${buildingName(voucher.buildingId)} · ${VOUCHER_CATEGORY_TEXT[voucher.category]}`}
        actions={
          <VoucherActions
            voucher={voucher}
            requestFile={requestFile}
            canOperate={hasCapability(data.viewer, 'FUND_OPERATE')}
            canApprove={hasCapability(data.viewer, 'FUND_APPROVE')}
            online={online}
            command={command}
          />
        }
      />
      {online ? null : <Notice tone="warning">Đang mất kết nối — chưa ghi được chứng từ.</Notice>}
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
      {voucher.cancelRequest ? <Notice tone="warning">Đề nghị hủy chờ BQT duyệt: {voucher.cancelRequest.reason}</Notice> : null}
      {voucher.cancelReason ? <Notice tone="info">Phiếu đã hủy. Lý do: {voucher.cancelReason}</Notice> : null}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Thông tin phiếu chi" />
          <CardBody className="space-y-3 pt-0">
            <InfoGrid
              items={[
                { label: 'Số tiền', value: <Spoken spoken={spokenVnd(voucher.amountVnd)} className="tabular-nums font-semibold">{formatVndText(voucher.amountVnd)}</Spoken> },
                { label: 'Nhóm chi', value: VOUCHER_CATEGORY_TEXT[voucher.category] },
                ...(voucher.targetFundKind ? [{ label: 'Quỹ nhận', value: TARGET_FUND_TEXT[voucher.targetFundKind] }] : []),
                { label: 'Người nhận', value: voucher.payeeName },
                { label: 'Tài khoản người nhận', value: voucher.payeeAccount ?? '—' },
                { label: 'Ngày chi', value: voucher.paidOn ? formatDate(voucher.paidOn) : '—' },
              ]}
            />
            {requestFile ? <AttachmentList attachments={[requestFile]} /> : null}
            {proofFile ? <AttachmentList attachments={[proofFile]} /> : null}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Lịch sử quyết định" />
          <CardBody className="pt-0">
            {decisions.length ? (
              <ol className="space-y-1.5 text-sm">
                {decisions.map((row) => (
                  <li key={row.id}>
                    <span className="font-medium">{DECISION_TEXT[row.decision] ?? row.decision}</span> · {userName(row.decidedBy)} · {formatDateTime(row.decidedAt)}
                    {row.reason ? <span className="block text-ink-2">{row.reason}</span> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink-2">Phiếu còn nháp.</p>
            )}
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader title="Nhật ký" />
        <CardBody className="pt-0">
          <AuditTimeline events={audit} />
        </CardBody>
      </Card>
    </div>
  );
};

export default VoucherPage;
