import { Link } from 'react-router';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { FundReport } from '@/services/report-api';
import { formatDate } from '@/utils/date';
import { formatVndText } from '@/utils/money';
import { millions } from './report-format';

/**
 * D1 p. 13 right column: the closing with where it came from, then what is tracked apart — never added to the fund
 * (BR-F5-04: "Còn phải thu theo dõi riêng, chưa cộng vào tiền quỹ.").
 */
export const ReportSideCards = ({ report }: { report: FundReport }) => (
  <div className="space-y-4">
    <Card>
      <CardHeader title="Số dư cuối kỳ" />
      <CardBody className="space-y-1.5 pt-0 text-sm">
        <p className="text-2xl font-semibold tabular-nums">{millions(report.figures.closingVnd)} triệu</p>
        <ul className="space-y-1">
          {report.sources.map((row) => (
            <li key={`${row.direction}-${row.category}`} className="flex justify-between gap-2">
              <span>{row.label}</span>
              <span className="tabular-nums text-ink-2">
                ({row.direction === 'IN' ? '+' : '−'}
                {millions(row.amountVnd)} triệu)
              </span>
            </li>
          ))}
        </ul>
        <p className="border-t border-line pt-1.5 text-ink-2">trong đó tiền cọc đang giữ: {formatVndText(report.depositHeldVnd)}</p>
      </CardBody>
    </Card>
    <Card>
      <CardHeader title="Theo dõi riêng · không cộng vào quỹ" />
      <CardBody className="space-y-2 pt-0 text-sm">
        <p className="font-semibold">Còn phải thu: {formatVndText(report.outstandingVnd)}</p>
        <ul className="space-y-1">
          {report.outstanding.map((row) => (
            <li key={`${row.contractId}-${row.periodNo}`}>
              <Link to={`/exploitation/contracts/${row.contractId}?tab=receipts`} className="text-accent hover:underline">
                {row.code}
              </Link>{' '}
              · {row.partner} · kỳ {row.periodNo} · <span className="tabular-nums">{formatVndText(row.remainingVnd)}</span>
              {row.overdueDays > 0 ? ` · quá hạn ${row.overdueDays} ngày` : ` · hạn ${formatDate(row.dueDate)}`}
            </li>
          ))}
        </ul>
        <p className="font-semibold">Không thu được trong kỳ: {formatVndText(report.writeOffVnd)}</p>
        <ul className="space-y-1">
          {report.writeOffs.map((row) => (
            <li key={row.writeOffCode}>
              {row.code} · {row.partner} · {row.writeOffCode} · {formatDate(row.approvedOn)} · <span className="tabular-nums">{formatVndText(row.amountVnd)}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-3">Còn phải thu theo dõi riêng, chưa cộng vào tiền quỹ.</p>
      </CardBody>
    </Card>
  </div>
);
