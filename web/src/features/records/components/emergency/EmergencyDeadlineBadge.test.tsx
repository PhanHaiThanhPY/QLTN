// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import type { EmergencyInfo } from '@/domain/types';
import { EmergencyDeadlineBadge } from './EmergencyDeadlineBadge';

/** B06-S1 ui-brief §2.3: four forms of the deadline badge; in api mode the hours come from the server. */
const EMERGENCY: EmergencyInfo = {
  startedAt: '2026-10-27T02:10:00.000Z',
  startedBy: 'usr-bql',
  reason: 'Ống cấp chính vỡ.',
  estimatedAmountVnd: 12_500_000,
  contractorName: 'Cty TNHH Bình An',
  limitVnd: 15_000_000,
  // Far from this machine's clock on purpose: the badge must use hoursLeft/docsOverdue, not the device time.
  docsDueAt: '2030-01-01T00:00:00.000Z',
};

describe('EmergencyDeadlineBadge', () => {
  it('shows the server hours left', () => {
    render(<EmergencyDeadlineBadge emergency={{ ...EMERGENCY, hoursLeft: 18, docsOverdue: false }} />);
    expect(screen.getByText('Còn khoảng 18 giờ để bổ sung hồ sơ')).toBeTruthy();
  });

  it('shows the hours overdue', () => {
    render(<EmergencyDeadlineBadge emergency={{ ...EMERGENCY, hoursLeft: -3, docsOverdue: true }} />);
    expect(screen.getByText('Quá hạn bổ sung 3 giờ')).toBeTruthy();
  });

  it('shows documents submitted on time', () => {
    render(<EmergencyDeadlineBadge emergency={{ ...EMERGENCY, docsSubmittedAt: '2026-10-27T08:00:00.000Z', hoursLeft: null }} />);
    expect(screen.getByText('Đã bổ sung đúng hạn')).toBeTruthy();
  });

  it('shows a late submission with its reason on hover', () => {
    render(
      <EmergencyDeadlineBadge
        emergency={{ ...EMERGENCY, docsSubmittedAt: '2026-10-29T08:00:00.000Z', lateReason: 'Chờ báo giá.', hoursLeft: null }}
      />,
    );
    const badge = screen.getByText('Bổ sung trễ hạn');
    expect(badge.closest('[title]')?.getAttribute('title')).toBe('Lý do trễ: Chờ báo giá.');
  });
});
