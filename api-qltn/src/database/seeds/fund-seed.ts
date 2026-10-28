import { randomUUID } from 'crypto';
import type { DataSource } from 'typeorm';
import { vnDate } from '../../common/utils/vn-date';
import { addMonthsClamped } from '../../domain/maintenance-schedule';
import type { FileStorage } from '../../modules/attachments/file-storage';
import { Attachment } from '../../modules/attachments/entities/attachment.entity';
import { SUBJECT_TYPE } from '../../modules/audit/entities/audit-event.entity';
import { ExploitationContract } from '../../modules/exploitation/entities/exploitation-contract.entity';
import { ExploitationPackage } from '../../modules/exploitation/entities/exploitation-package.entity';
import type { ReceiptsService } from '../../modules/exploitation/receipts.service';
import { FundVoucherDecision } from '../../modules/fund/entities/fund-voucher-decision.entity';
import { FundVoucher } from '../../modules/fund/entities/fund-voucher.entity';
import { Fund } from '../../modules/fund/entities/fund.entity';
import type { FundFilePurpose } from '../../modules/fund/fund-files';
import type { FundsService } from '../../modules/fund/funds.service';
import type { TaxService } from '../../modules/fund/tax.service';
import type { VouchersService } from '../../modules/fund/vouchers.service';
import { actorOf } from './exploitation-contract-seed';
import { DEMO_PACKAGE_NAME, samplePdf } from './exploitation-seed';

interface Deps {
  dataSource: DataSource;
  storage: FileStorage;
  funds: FundsService;
  receipts: ReceiptsService;
  taxes: TaxService;
  vouchers: VouchersService;
  now: Date;
}

/**
 * SPEC F-S3 BR-F3-15: the D1 example on the exploitation fund of HĐ-001's building, in the month before the seed runs
 * (so every date is in the past): opening 50.000.000 on the 1st; PT-001 10.000.000 on the 18th and PT-002 5.000.000
 * on the 22nd, both to HĐ-001's first period; TH-001 2.000.000 paid by GNT-001 on the 22nd; PC-001 "Chi dịch vụ"
 * 3.000.000 paid on the 23rd. The month closes at 50 + 15 − 5 = 60 tr. Everything goes through the services; only
 * PC-001's approval is moved back to the 20th so it can be paid on the 23rd. Once, never in production (caller).
 */
export const ensureFundDemo = async (deps: Deps): Promise<number> => {
  const { dataSource } = deps;
  const pkg = await dataSource.getRepository(ExploitationPackage).findOneBy({ name: DEMO_PACKAGE_NAME });
  const contract = pkg
    ? await dataSource.getRepository(ExploitationContract).findOneBy({ packageId: pkg.id, status: 'ACTIVE' })
    : null;
  if (!contract) return 0;
  const fund = await dataSource.getRepository(Fund).findOneBy({ buildingId: contract.buildingId, kind: 'KHAI_THAC' });
  const [accountant, board] = await Promise.all([actorOf(dataSource, 'KTOAN-A'), actorOf(dataSource, 'BQT')]);
  if (!fund || fund.openingDate !== null || !accountant || !board) return 0;

  const month = addMonthsClamped(`${vnDate(deps.now).slice(0, 7)}-01`, -1).slice(0, 7);
  const day = (n: number): string => `${month}-${String(n).padStart(2, '0')}`;
  const file = async (purpose: FundFilePurpose, name: string): Promise<string> => {
    const key = randomUUID();
    const content = samplePdf(name);
    await deps.storage.save(key, content);
    const saved = await dataSource.getRepository(Attachment).save(
      dataSource.getRepository(Attachment).create({
        subjectType: SUBJECT_TYPE.FUND,
        subjectId: fund.id,
        buildingId: fund.buildingId,
        purpose,
        fileName: name,
        mimeType: 'application/pdf',
        sizeBytes: content.length,
        contentRef: key,
        uploadedBy: accountant.id,
      }),
    );
    return saved.id;
  };

  await deps.funds.setup(accountant, fund.id, {
    version: fund.version,
    bankName: 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)',
    accountNo: '0071000000001',
    accountHolder: 'Ban quản trị Tòa A – An Khang Residence',
    openingDate: day(1),
    openingBalanceVnd: '50000000',
  });
  for (const [n, amount, name] of [
    [18, '10000000', 'PT-001 Giấy báo có.pdf'],
    [22, '5000000', 'PT-002 Giấy báo có.pdf'],
  ] as const) {
    await deps.receipts.record(accountant, contract.id, {
      receivedOn: day(n),
      amountVnd: amount,
      attachmentId: await file('RECEIPT_PROOF', name),
      note: 'DV-A chuyển khoản',
    });
  }
  const tax = await deps.taxes.create(accountant, fund.id, {
    month,
    amountVnd: '2000000',
    attachmentId: await file('TAX_FILING', `Hồ sơ thuế tháng ${month}.pdf`),
  });
  await deps.taxes.pay(accountant, tax.id, {
    paidOn: day(22),
    amountVnd: '2000000',
    attachmentId: await file('TAX_PAYMENT_SLIP', 'GNT-001 Giấy nộp tiền.pdf'),
  });
  let voucher = await deps.vouchers.create(accountant, fund.id, {
    category: 'SERVICE',
    content: 'Chi dịch vụ vệ sinh sảnh khu khai thác',
    payeeName: 'Công ty Vệ sinh Sạch Xanh',
    payeeAccount: '1903 5555 0001',
    amountVnd: '3000000',
    requestAttachmentId: await file('VOUCHER_REQUEST', 'PC-001 Đề nghị chi.pdf'),
  });
  voucher = await deps.vouchers.submit(accountant, voucher.id, { version: voucher.version });
  voucher = await deps.vouchers.approve(board, voucher.id, { version: voucher.version });
  const approvedAt = new Date(`${day(20)}T09:00:00+07:00`);
  await dataSource.getRepository(FundVoucher).update({ id: voucher.id }, { approvedAt });
  await dataSource
    .getRepository(FundVoucherDecision)
    .update({ voucherId: voucher.id, decision: 'APPROVE' }, { decidedAt: approvedAt });
  await deps.vouchers.pay(accountant, voucher.id, {
    version: voucher.version,
    paidOn: day(23),
    proofAttachmentId: await file('VOUCHER_PROOF', 'PC-001 Ủy nhiệm chi.pdf'),
  });
  return 1;
};
