import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatVndText } from '@/utils/money';
import { checkLine, millions } from './report-format';

interface WaterfallChartProps {
  figures: { openingVnd: string; inVnd: string; outVnd: string; closingVnd: string };
  /** Print: black and white, shades and labels only (ui-brief §2.2). */
  variant?: 'screen' | 'print';
}

interface Bar {
  key: string;
  label: string;
  /** The bar's value label: "50", "+15", "−5". */
  value: string;
  amountVnd: string;
  from: bigint;
  to: bigint;
  fill: string;
  stroke?: string;
}

const WIDTH = 520;
const HEIGHT = 240;
const TOP = 28;
const BOTTOM = 34;
const LEFT = 16;
const BAR = 72;

const FILLS = {
  screen: { total: 'var(--series-1)', in: 'var(--series-2)', out: 'var(--series-3)' },
  print: { total: '#333', in: '#999', out: '#fff' },
} as const;

/**
 * BR-F5-02 waterfall (dataviz: one axis, unit stated, signed value labels so colour is never the only cue; the colours
 * are validated in light and dark — supporting/evidence/waterfall-palette.txt). Hover shows the full amount; the
 * table view carries the same numbers.
 */
export const WaterfallChart = ({ figures, variant = 'screen' }: WaterfallChartProps) => {
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const fills = FILLS[variant];
  const opening = BigInt(figures.openingVnd);
  const inflow = BigInt(figures.inVnd);
  const outflow = BigInt(figures.outVnd);
  const closing = BigInt(figures.closingVnd);
  const bars: Bar[] = [
    { key: 'opening', label: 'Đầu kỳ', value: millions(figures.openingVnd), amountVnd: figures.openingVnd, from: 0n, to: opening, fill: fills.total },
    { key: 'in', label: 'Thu', value: `+${millions(figures.inVnd)}`, amountVnd: figures.inVnd, from: opening, to: opening + inflow, fill: fills.in },
    {
      key: 'out',
      label: 'Chi',
      value: `−${millions(figures.outVnd)}`,
      amountVnd: figures.outVnd,
      from: opening + inflow - outflow,
      to: opening + inflow,
      fill: fills.out,
      stroke: variant === 'print' ? '#000' : undefined,
    },
    { key: 'closing', label: 'Cuối kỳ', value: millions(figures.closingVnd), amountVnd: figures.closingVnd, from: 0n, to: closing, fill: fills.total },
  ];
  const top = [opening, opening + inflow, closing].reduce((max, value) => (value > max ? value : max), 1n);
  const plot = HEIGHT - TOP - BOTTOM;
  const y = (value: bigint): number => TOP + plot - Number((value * BigInt(Math.round(plot * 1000))) / top) / 1000;
  const step = (WIDTH - LEFT * 2) / bars.length;
  const summary = `Đầu kỳ ${millions(figures.openingVnd)} triệu, thu ${millions(figures.inVnd)} triệu, chi ${millions(figures.outVnd)} triệu, cuối kỳ ${millions(figures.closingVnd)} triệu đồng`;
  const tooltip = bars.find((bar) => bar.key === hover);
  // The table is always rendered for screens and shown by CSS below 640px.
  const narrow = variant === 'screen';
  const ink = variant === 'print' ? '#000' : 'var(--ink)';
  const muted = variant === 'print' ? '#000' : 'var(--ink-2)';
  return (
    <div className="space-y-2">
      {/* Below 640px the bars become the table (ui-brief §3); print always draws them. */}
      <div className={variant === 'print' ? 'relative' : 'relative hidden sm:block'}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={summary}>
          <line x1={LEFT} x2={WIDTH - LEFT} y1={y(0n)} y2={y(0n)} stroke={variant === 'print' ? '#000' : 'var(--line)'} strokeWidth={1} />
          {bars.map((bar, index) => {
            const x = LEFT + index * step + (step - BAR) / 2;
            const yTop = y(bar.to);
            const height = Math.max(2, y(bar.from) - yTop);
            return (
              <g key={bar.key} onMouseEnter={() => setHover(bar.key)} onMouseLeave={() => setHover(null)}>
                <title>{`${bar.label}: ${formatVndText(bar.amountVnd)}`}</title>
                {/* A wider transparent target than the mark (interaction spec). */}
                <rect x={x - 8} y={TOP - 20} width={BAR + 16} height={plot + 20} fill="transparent" />
                <rect x={x} y={yTop} width={BAR} height={height} rx={4} fill={bar.fill} stroke={bar.stroke ?? 'none'} strokeWidth={bar.stroke ? 1 : 0} />
                <text x={x + BAR / 2} y={yTop - 6} textAnchor="middle" fontSize={14} fontWeight={600} fill={ink}>
                  {bar.value}
                </text>
                <text x={x + BAR / 2} y={HEIGHT - 12} textAnchor="middle" fontSize={12} fill={muted}>
                  {bar.label}
                </text>
              </g>
            );
          })}
        </svg>
        {tooltip && variant === 'screen' ? (
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-md border border-line bg-surface px-2 py-1 text-xs shadow-card" role="status">
            {tooltip.label}: <span className="tabular-nums font-semibold">{formatVndText(tooltip.amountVnd)}</span>
          </div>
        ) : null}
      </div>
      <p className={variant === 'print' ? 'text-xs' : 'hidden text-xs sm:block'} style={{ color: muted }}>
        Đơn vị: triệu đồng · {checkLine(figures)}
      </p>
      {variant === 'screen' ? (
        <Button className="hidden sm:inline-flex" size="sm" variant="ghost" aria-expanded={table} onClick={() => setTable(!table)}>
          {table ? 'Ẩn bảng' : 'Xem dạng bảng'}
        </Button>
      ) : null}
      {table || variant === 'print' || narrow ? (
        <table className={table || variant === 'print' ? 'w-full text-sm' : 'w-full text-sm sm:hidden'}>
          <caption className="sr-only">Dòng tiền quỹ khai thác, đơn vị đồng</caption>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.key} className="border-b border-line">
                <th scope="row" className="py-1 pr-3 text-left font-normal">
                  {bar.label}
                </th>
                {variant === 'screen' ? (
                  <td className="w-1/3 py-1 pr-3" aria-hidden>
                    <span className="block h-2 rounded-sm" style={{ width: `${Number(((bar.to - bar.from) * 100n) / top)}%`, background: bar.fill }} />
                  </td>
                ) : null}
                <td className="py-1 text-right tabular-nums">
                  {bar.key === 'in' ? '+' : ''}
                  {bar.key === 'out' ? '−' : ''}
                  {formatVndText(bar.amountVnd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
};
