// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { RecordSummaryCards } from './RecordSummaryCards';

const SUMMARY = {
  open: 12,
  needsUpdate: 3,
  completed: 25,
  total: 40,
  asOf: '2026-10-24T03:00:00.000Z',
};

const renderCards = (buildingId?: string) =>
  render(
    <MemoryRouter>
      <RecordSummaryCards summary={SUMMARY} buildingId={buildingId} />
    </MemoryRouter>,
  );

const linkedPaths = (): string[] => screen.getAllByRole('link').map((link) => link.getAttribute('href') ?? '');

describe('RecordSummaryCards', () => {
  it('should render server numbers with unit and denominator, each linking to its filtered list', () => {
    renderCards();

    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('25')).toBeTruthy();
    expect(screen.getByText('hồ sơ đang mở')).toBeTruthy();
    expect(screen.getByText('hồ sơ cần bổ sung')).toBeTruthy();
    expect(screen.getByText('hồ sơ hoàn tất')).toBeTruthy();
    expect(screen.getAllByText('trên 40 hồ sơ')).toHaveLength(3);
    expect(linkedPaths()).toEqual([
      '/records?open=1',
      '/records?attention=needs_update',
      '/records?status=COMPLETED',
    ]);
  });

  it('should keep the building scope in every link so meta.total matches the card', () => {
    renderCards('bld-a');

    expect(linkedPaths()).toEqual([
      '/records?open=1&buildingId=bld-a',
      '/records?attention=needs_update&buildingId=bld-a',
      '/records?status=COMPLETED&buildingId=bld-a',
    ]);
  });

  it('should say where the numbers come from and what is not counted yet', () => {
    renderCards();

    const source = screen.getByText(/Nguồn số liệu/);
    expect(source.textContent).toContain('phạm vi tòa nhà của bạn');
    expect(source.textContent).toContain('24/10/2026');
    expect(source.textContent).toContain('Chưa tính hồ sơ quá hạn và thiếu phân công');
  });
});
