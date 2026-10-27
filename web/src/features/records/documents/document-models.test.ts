import { advance, completedDetail, NAMES, passedRound, failedRound, settlement, submission } from './__fixtures__/completed-record';
import { buildDocumentList, NO_LETTER_NOTE } from './document-list';
import { buildMinutesModel } from './minutes-model';
import { buildPaymentLetterModel } from './payment-letter-model';
import { DOTS, orDots, printVnd } from './print-format';
import { buildProposalModel, quoteTables } from './proposal-model';

describe('document list (SPEC B7-S1 BR-B7-01, AC-B7.1/7.2/7.12)', () => {
  it('lists the 6 documents of the test record, oldest first, with their status and signatures', () => {
    const rows = buildDocumentList(completedDetail());
    expect(rows.map((row) => [row.title, row.status, `${row.signed}/${row.signatureSlots}`])).toEqual([
      ['Tờ trình · lần 1', 'Bị từ chối', '2/2'],
      ['Tờ trình · lần 2', 'Đã duyệt', '2/2'],
      ['Thư đề nghị · đợt 1 tạm ứng', 'Đã chuyển', '1/1'],
      ['Biên bản nghiệm thu · lượt 1', 'Không đạt', '2/3'],
      ['Biên bản nghiệm thu · lượt 2', 'Đạt', '3/3'],
      ['Thư đề nghị · đợt 2 quyết toán', 'Đã chuyển', '1/1'],
    ]);
  });

  it('is empty before the first submission', () => {
    expect(buildDocumentList(completedDetail({ quoteProposal: undefined, execution: undefined, paymentHistory: undefined }))).toEqual([]);
  });

  it('offers no letter for a 0-đồng settlement', () => {
    const zero = { ...settlement, amountVnd: '0', settlementAmountVnd: '4000000' };
    const detail = completedDetail({ paymentHistory: { approvedAmountVnd: '10000000', transferredTotalVnd: '4000000', draft: null, payments: [advance, zero] } });
    const row = buildDocumentList(detail).find((item) => item.docId === zero.id);
    expect(row).toMatchObject({ printable: false, note: NO_LETTER_NOTE });
  });
});

describe('proposal (§3.1, AC-B7.4–7.7)', () => {
  it('fills the approved attempt with both signatures and no watermark', () => {
    const detail = completedDetail();
    const model = buildProposalModel(detail, detail.quoteProposal?.submissions[1] ?? submission(2), NAMES);
    expect(model.isApproved).toBe(true);
    expect(model.fields).toContainEqual({ label: 'Người trình', value: 'Nguyễn Thu Hà' });
    expect(model.fields).toContainEqual({ label: 'Thẩm định nội dung', value: 'Võ Thanh Tâm' });
    expect(model.fields).toContainEqual({ label: 'Lần trình thứ', value: '2' });
    expect(model.proposalLine).toBe(
      'Kính trình Ban Quản Trị phê duyệt chi phí Thay ống cấp nước hành lang tầng 3 do đơn vị Công ty Nam Phát thực hiện với chi phí: 10.000.000 VNĐ (đã bao gồm VAT)',
    );
    expect(model.boardSignature).toMatchObject({ signerName: 'Bùi Hải Yến', signedAt: '2026-10-22T07:02:00.000Z' });
    expect(model.managerSignature).toMatchObject({ signerName: 'Nguyễn Thu Hà' });
    expect(model.boardOpinion).toBe(DOTS);
    expect(model.hasIncidentMinutes && model.hasQuotations).toBe(true);
    expect(model.desiredDate).toBe('30/10/2026');
  });

  it('shows the refusal reason and the BQT signature of the refusal on attempt 1, unapproved', () => {
    const detail = completedDetail();
    const model = buildProposalModel(detail, detail.quoteProposal?.submissions[0] ?? submission(1), NAMES);
    expect(model.isApproved).toBe(false);
    expect(model.boardOpinion).toBe('Báo giá chưa có dấu.');
    expect(model.boardSignature?.signedAt).toBe('2026-10-21T04:00:00.000Z');
  });

  it('splits 5 contractors into tables of 3 + 2 that repeat the items, with cost, tax and total', () => {
    const names = ['A', 'B', 'C', 'D', 'E'];
    const five = submission(2, {
      content: {
        ...submission(2).content,
        contractors: names.map((name, index) => ({ name, unitPricesVnd: [`${index + 1}000000`], otherCostVnd: '0', taxVnd: '100000', quotationAttachmentIds: [] })),
        contractorTotals: names.map((_, index) => ({ lineTotalsVnd: [`${(index + 1) * 2}000000`], subtotalVnd: `${(index + 1) * 2}000000`, totalVnd: `${(index + 1) * 2}100000` })),
      },
    });
    const tables = quoteTables(five);
    expect(tables.map((table) => table.contractors.map((column) => column.name))).toEqual([['A', 'B', 'C'], ['D', 'E']]);
    expect(tables[1].items).toEqual(five.content.items);
    expect(tables[1].contractors[1]).toMatchObject({ unitPrices: ['5.000.000'], lineTotals: ['10.000.000'], subtotal: '10.000.000', tax: '100.000', total: '10.100.000' });
  });

  it('prints dots for missing values and never undefined, null or NaN (AC-B7.7)', () => {
    const bare = submission(1, { content: { ...submission(1).content, preparedByName: '', reviewerUserId: null, desiredApprovalDate: null } });
    const model = buildProposalModel(completedDetail(), bare, NAMES);
    expect(model.fields).toContainEqual({ label: 'Người làm tờ trình', value: DOTS });
    expect(model.fields).toContainEqual({ label: 'Thẩm định nội dung', value: DOTS });
    expect(model.desiredDate).toBe(DOTS);
    // Every printed string; structural nulls (an unsigned box) are not printed text.
    const texts: string[] = [];
    const collect = (value: unknown): void => {
      if (typeof value === 'string') texts.push(value);
      else if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === 'object') Object.values(value).forEach(collect);
    };
    collect(model);
    expect(texts.filter((text) => /undefined|null|NaN/.test(text))).toEqual([]);
  });
});

describe('acceptance minutes (§3.2, AC-B7.8/7.9)', () => {
  it('ticks KHÔNG ĐẠT and lists the member who asked for a fix on round 1', () => {
    const model = buildMinutesModel(completedDetail(), failedRound, NAMES);
    expect(model.outcome).toBe('FAILED');
    expect(model.notes).toEqual(['BQT duyệt (Bùi Hải Yến): Mối nối còn rò, cần làm lại.']);
    expect(model.openingLine).toBe('Hôm nay, vào lúc 09 giờ 30, ngày 24 tháng 10 năm 2026, tại: Hành lang tầng 3');
  });

  it('ticks ĐẠT with the 3 signatures on round 2, and "Khác" empty', () => {
    const model = buildMinutesModel(completedDetail(), passedRound, NAMES);
    expect(model.outcome).toBe('PASSED');
    expect(model.columns.map((column) => [column.label, column.signature?.signerName ?? null])).toEqual([
      ['Đại diện BQL', 'Nguyễn Thu Hà'],
      ['Đại diện BQT', 'Bùi Hải Yến'],
      ['Đại diện TVKT', 'Võ Thanh Tâm'],
      ['Khác', null],
    ]);
    expect(model.representatives.map((row) => row.name)).toEqual(['Nguyễn Thu Hà', 'Bùi Hải Yến', 'Võ Thanh Tâm']);
  });

  it('leaves both boxes empty and only the decided member signed while the round is open', () => {
    const open = { ...passedRound, outcome: 'PENDING' as const, decisions: passedRound.decisions.slice(0, 1) };
    const model = buildMinutesModel(completedDetail(), open, NAMES);
    expect(model).toMatchObject({ isComplete: false, outcome: null });
    expect(model.columns.filter((column) => column.signature).map((column) => column.label)).toEqual(['Đại diện BQL']);
  });
});

describe('payment letter (§3.3, AC-B7.10–7.12)', () => {
  it('prints the settlement instalment with its computation, words and the 4 attachments ticked', () => {
    const model = buildPaymentLetterModel(completedDetail(), settlement, NAMES);
    expect(model).toMatchObject({
      amount: '6.000.000',
      amountInWords: 'Sáu triệu đồng',
      computation: '(Số quyết toán 10.000.000 − tạm ứng đã chuyển 4.000.000)',
      recipient: 'Ban quản trị tòa nhà Tòa A – An Khang Residence',
      isApproved: true,
    });
    expect(model.attachments.map((row) => [row.label, row.isPresent])).toEqual([
      ['Công văn đề nghị thanh toán của nhà thầu', true],
      ['Tờ trình và báo giá đã được phê duyệt', true],
      ['Biên bản nghiệm thu hoàn thành', true],
      ['Hóa đơn GTGT', true],
    ]);
  });

  it('lists the advance attachments and marks a pending instalment unapproved', () => {
    const model = buildPaymentLetterModel(completedDetail(), { ...advance, status: 'PENDING_APPROVAL' }, NAMES);
    expect(model.attachments.map((row) => row.label)).toEqual(['Đề nghị tạm ứng của nhà thầu', 'Tờ trình và báo giá đã được phê duyệt']);
    expect(model).toMatchObject({ isApproved: false, computation: null });
  });
});

describe('print formatting (BR-B7-03, BR-B7-07)', () => {
  it('formats money as integers and replaces missing values with dots', () => {
    expect(printVnd('12500000')).toBe('12.500.000');
    expect(printVnd(undefined)).toBe(DOTS);
    expect(orDots('  ')).toBe(DOTS);
  });
});
