// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { advance, completedDetail, failedRound, NAMES, passedRound, settlement } from '../__fixtures__/completed-record';
import { buildDocument, type PrintableDocument } from '../build-document';
import type { DocumentKind } from '../document-list';
import { DocumentView } from './DocumentView';

/** SPEC B7-S1 §3.1–3.3, BR-B7-03..06: the three paper documents rendered from the test record. */
const renderDocument = (kind: DocumentKind, docId: string, detail = completedDetail()) => {
  const document = buildDocument(detail, kind, docId, NAMES) as PrintableDocument;
  return render(
    <MemoryRouter>
      <DocumentView recordId="rec-1" recordCode="SC-014" document={document} />
    </MemoryRouter>,
  );
};

const sheetText = () => (document.querySelector('.d5-sheet') as HTMLElement).textContent ?? '';

describe('DocumentView', () => {
  it('AC-B7.4 + AC-B7.7: the approved proposal has both signatures, dotted unknowns, no watermark and no undefined', () => {
    renderDocument('proposal', 'sub-2');
    expect(screen.getByRole('heading', { level: 1, name: 'Tờ trình' })).toBeTruthy();
    expect(screen.getByAltText('Chữ ký của Bùi Hải Yến')).toBeTruthy();
    expect(screen.getByAltText('Chữ ký của Nguyễn Thu Hà')).toBeTruthy();
    expect(sheetText()).toContain('Số tờ trình: ……………………');
    expect(sheetText()).toContain('Ký trên hệ thống QLTN lúc 14:02 22/10/2026');
    expect(document.querySelector('.d5-watermark')).toBeNull();
    expect(sheetText()).not.toMatch(/undefined|null|NaN/);
    expect(sheetText()).toContain('Bản in từ hệ thống QLTN · SC-014 · Tờ trình lần 2 · in lúc');
    expect(screen.getAllByRole('columnheader', { name: 'Thành tiền' })).toHaveLength(1);
  });

  it('AC-B7.5: the refused proposal carries "CHƯA PHÊ DUYỆT" and the refusal reason', () => {
    renderDocument('proposal', 'sub-1');
    expect(document.querySelector('.d5-watermark')?.textContent).toBe('CHƯA PHÊ DUYỆT');
    expect(screen.getByText('Bản chưa phê duyệt')).toBeTruthy();
    expect(sheetText()).toContain('Báo giá chưa có dấu.');
  });

  it('AC-B7.8: the failed round ticks KHÔNG ĐẠT, the passed round ĐẠT with 3 signatures and an empty "Khác"', () => {
    const { unmount } = renderDocument('minutes', failedRound.id);
    expect(sheetText()).toContain('☐ ĐẠT ☒ KHÔNG ĐẠT');
    expect(sheetText()).toContain('BQT duyệt (Bùi Hải Yến): Mối nối còn rò, cần làm lại.');
    unmount();
    renderDocument('minutes', passedRound.id);
    expect(sheetText()).toContain('☒ ĐẠT ☐ KHÔNG ĐẠT');
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getByText('Khác')).toBeTruthy();
  });

  it('AC-B7.9: an open round is "CHƯA HOÀN TẤT" with no box ticked', () => {
    const open = { ...passedRound, outcome: 'PENDING' as const, decisions: passedRound.decisions.slice(0, 1) };
    const detail = completedDetail({ execution: { construction: null, acceptances: [failedRound, open], repairDraft: null } });
    renderDocument('minutes', open.id, detail);
    expect(document.querySelector('.d5-watermark')?.textContent).toBe('CHƯA HOÀN TẤT');
    expect(sheetText()).toContain('☐ ĐẠT ☐ KHÔNG ĐẠT');
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });

  it('AC-B7.10: the settlement letter has the instalment, words, computation and 4 ticked attachments', () => {
    renderDocument('payment', settlement.id);
    expect(sheetText()).toContain('Số tiền: 6.000.000 VNĐ (Bằng chữ: Sáu triệu đồng)');
    expect(sheetText()).toContain('(Số quyết toán 10.000.000 − tạm ứng đã chuyển 4.000.000)');
    expect(sheetText().match(/✓/g)).toHaveLength(4);
    expect(screen.getByAltText('Chữ ký của Nguyễn Thu Hà')).toBeTruthy();
  });

  it('AC-B7.11 + AC-B7.12: the advance letter lists 2 attachments; a pending one is "CHƯA PHÊ DUYỆT"', () => {
    const pending = { ...advance, status: 'PENDING_APPROVAL' as const };
    const detail = completedDetail({ paymentHistory: { approvedAmountVnd: '10000000', transferredTotalVnd: '0', draft: null, payments: [pending] } });
    renderDocument('payment', pending.id, detail);
    expect(sheetText()).toContain('Đề nghị tạm ứng của nhà thầu');
    expect(sheetText()).not.toContain('Hóa đơn GTGT');
    expect(document.querySelector('.d5-watermark')?.textContent).toBe('CHƯA PHÊ DUYỆT');
  });

  it('builds no letter for a 0-đồng settlement', () => {
    const zero = { ...settlement, amountVnd: '0' };
    const detail = completedDetail({ paymentHistory: { approvedAmountVnd: '10000000', transferredTotalVnd: '10000000', draft: null, payments: [advance, zero] } });
    expect(buildDocument(detail, 'payment', zero.id, NAMES)).toBeNull();
  });
});
