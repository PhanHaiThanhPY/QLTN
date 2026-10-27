import { useState } from 'react';
import { Notice } from '@/components/common/Notice';
import { PageHeader } from '@/components/common/PageHeader';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ERROR_CODE } from '@/domain/errors';
import { hasCapability } from '@/domain/permissions';
import { useCommand } from '@/hooks/useCommand';
import { useOnline } from '@/hooks/useOnline';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { getReconciliation, type LedgerSide, type ReconciliationMonth, type StatementLine } from '@/services/statement-api';
import { formatDate } from '@/utils/date';
import { formatVndText } from '@/utils/money';
import { FigureRow } from '@/features/exploitation/components/FigureRow';
import { shortVnd } from '@/features/exploitation/contract-ui';
import { FundToolbar } from './components/FundToolbar';
import { ImportStatementDialog } from './components/ImportStatementDialog';
import { MatchDialog } from './components/MatchDialog';
import { MatchedPairs } from './components/MatchedPairs';
import { RecordFromStatementDialog } from './components/RecordFromStatementDialog';
import { StatementImports } from './components/StatementImports';
import { StatementStatus } from './components/StatementStatus';
import { UnmatchedBlock } from './components/UnmatchedBlock';
import { accountText, monthText } from './fund-ui';
import { useFundScope } from './useFundScope';

type Matching = { line?: StatementLine; entry?: LedgerSide } | null;
type Pair = ReconciliationMonth['pairs'][number];

const NONE = 'Chưa có sao kê';
const figure = (amount: string | null): string => (amount === null ? NONE : shortVnd(amount));

/** "Sao kê và đối soát" (SPEC F-S4, ui-brief §2.1): the month by the bank against the ledger, line by line. */
const ReconciliationPage = () => {
  const scope = useFundScope();
  const { data } = useReferenceData();
  const online = useOnline();
  const [importing, setImporting] = useState(false);
  const [matching, setMatching] = useState<Matching>(null);
  const [unmatching, setUnmatching] = useState<Pair | null>(null);
  const [recording, setRecording] = useState<StatementLine | null>(null);
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const command = useCommand({ successMessage: 'Đã cập nhật đối soát.' });
  const fund = scope.fund;
  const query = useServiceQuery(['fund', 'reconciliation', fund?.id, scope.month], () =>
    fund ? getReconciliation(fund.id, scope.month) : Promise.resolve(null),
  );
  if (scope.isLoading) return <LoadingState rows={4} />;
  if (scope.error) return <ErrorState error={scope.error} onRetry={scope.refetch} />;
  if (!fund || !data?.viewer) return <EmptyState title="Không có quỹ khai thác trong phạm vi của bạn." />;
  const canWrite = hasCapability(data.viewer, 'FUND_OPERATE') && online;
  const view = query.data;
  const run = (action: string, subjectId: string, payload: Record<string, unknown>) =>
    command.execute({ subjectType: 'FUND', subjectId, action, payload });

  const header = (
    <PageHeader
      title="Sao kê và đối soát"
      description={`Quỹ khai thác · Tài khoản ${accountText(fund)} · Theo sao kê`}
      actions={
        hasCapability(data.viewer, 'FUND_OPERATE') && fund.openingDate ? (
          <Button disabled={!online} onClick={() => setImporting(true)}>
            Nhập sao kê
          </Button>
        ) : null
      }
    />
  );
  if (!fund.openingDate)
    return (
      <div className="space-y-4">
        {header}
        <FundToolbar scope={scope} />
        <EmptyState title="Thiết lập quỹ trước khi nhập sao kê." />
      </div>
    );

  const body = () => {
    if (query.isLoading) return <LoadingState rows={4} />;
    if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    if (!view) return null;
    const noStatement = view.statement.closingVnd === null && view.counts.lines === 0;
    return (
      <>
        {view.openingWarning ? (
          <Notice tone="warning">
            Số dư đầu của sổ ({formatVndText(view.openingWarning.ledgerVnd)}) khác số dư theo sao kê đầu ngày {formatDate(view.openingWarning.date)} (
            {formatVndText(view.openingWarning.statementVnd)}).
          </Notice>
        ) : null}
        {canWrite && view.suggestions.length ? (
          <Notice tone="info">
            <span className="flex flex-wrap items-center gap-2">
              {view.suggestions.length} đề xuất ghép đang chờ xác nhận.
              <Button size="sm" isLoading={command.isPending} onClick={() => void run('confirmStatementSuggestions', fund.id, { month: scope.month })}>
                Xác nhận tất cả đề xuất
              </Button>
            </span>
          </Notice>
        ) : null}
        <FigureRow
          figures={[
            { label: 'Đầu kỳ', value: figure(view.statement.openingVnd) },
            { label: 'Thu', value: figure(view.statement.inVnd) },
            { label: 'Chi', value: figure(view.statement.outVnd) },
            { label: 'Cuối kỳ', value: figure(view.statement.closingVnd), hint: 'theo sao kê' },
          ]}
        />
        <StatementStatus view={view} />
        {noStatement ? (
          <Card>
            <CardBody className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-ink-2">Nhập sao kê {monthText(scope.month).toLowerCase()} để đối soát.</p>
              {canWrite ? <Button onClick={() => setImporting(true)}>Nhập sao kê</Button> : null}
            </CardBody>
          </Card>
        ) : (
          <MatchedPairs pairs={view.pairs} accountLabel={fund.accountMasked ?? ''} canOperate={canWrite} onUnmatch={setUnmatching} />
        )}
        <UnmatchedBlock
          view={view}
          hidden={skipped}
          canWrite={canWrite}
          busy={command.isPending}
          onConfirm={(row) => void run('matchStatementLine', row.line.id, { entryId: row.entry.id, reason: null })}
          onSkip={(lineId) => setSkipped(new Set([...skipped, lineId]))}
          onMatchLine={(line) => setMatching({ line })}
          onMatchEntry={(entry) => setMatching({ entry })}
          onRecord={setRecording}
        />
      </>
    );
  };

  return (
    <div className="space-y-4">
      {header}
      {online ? null : <Notice tone="warning">Đang mất kết nối.</Notice>}
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
      <FundToolbar scope={scope} />
      {body()}
      <Card>
        <CardHeader title={`Lần nhập${view ? ` (${view.imports})` : ''}`} />
        <CardBody className="pt-0">
          <StatementImports fundId={fund.id} canWrite={canWrite} />
        </CardBody>
      </Card>
      {importing ? <ImportStatementDialog fundId={fund.id} month={scope.month} onClose={() => setImporting(false)} /> : null}
      {matching ? <MatchDialog fundId={fund.id} line={matching.line} entry={matching.entry} onClose={() => setMatching(null)} /> : null}
      <ReasonDialog
        open={unmatching !== null}
        onOpenChange={(open) => (open ? undefined : setUnmatching(null))}
        title={`Bỏ ghép ${unmatching?.line.code ?? ''} · ${unmatching?.entry.sourceCode ?? ''}`}
        description="Hai dòng về Chưa ghép và Chưa đối soát; lịch sử ghép vẫn giữ."
        confirmLabel="Bỏ ghép"
        confirmVariant="danger"
        minLength={10}
        isPending={command.isPending}
        error={command.fieldErrors.reason}
        onConfirm={(reason) => {
          if (!unmatching) return;
          void run('unmatchStatementLine', unmatching.matchId, { reason }).then((result) => (result ? setUnmatching(null) : undefined));
        }}
      />
      {recording ? <RecordFromStatementDialog line={recording} command={command} onClose={() => setRecording(null)} /> : null}
    </div>
  );
};

export default ReconciliationPage;
