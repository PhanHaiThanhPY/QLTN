import type { DataSource } from 'typeorm';
import { vnDate } from '../../common/utils/vn-date';
import { addMonthsClamped } from '../../domain/maintenance-schedule';
import { monthBounds } from '../../domain/fund-ledger';
import { ExploitationContract } from '../../modules/exploitation/entities/exploitation-contract.entity';
import { ExploitationPackage } from '../../modules/exploitation/entities/exploitation-package.entity';
import { BankStatementImport } from '../../modules/fund/entities/bank-statement-import.entity';
import { Fund } from '../../modules/fund/entities/fund.entity';
import type { ReconciliationService } from '../../modules/fund/reconciliation.service';
import type { StatementsService } from '../../modules/fund/statements.service';
import { actorOf } from './exploitation-contract-seed';
import { DEMO_PACKAGE_NAME } from './exploitation-seed';

interface Deps {
  dataSource: DataSource;
  statements: StatementsService;
  reconciliation: ReconciliationService;
  now: Date;
}

/**
 * SPEC F-S4 BR-F4-13 after F-S3's D1 month (the month before the seed runs): one statement of that month, opening
 * 50.000.000 and closing 60.000.000, with GD-001 +10, GD-002 +5, GD-003 −2, GD-004 −3 on the documents' days, every
 * suggestion confirmed — 4/4 khớp, chênh lệch 0 đ, lệch/trùng 0/0. Through the services, from a template CSV so the
 * import keeps its file. Once, never in production (the caller guards it).
 */
export const ensureStatementDemo = async (deps: Deps): Promise<number> => {
  const { dataSource } = deps;
  const pkg = await dataSource.getRepository(ExploitationPackage).findOneBy({ name: DEMO_PACKAGE_NAME });
  const contract = pkg ? await dataSource.getRepository(ExploitationContract).findOneBy({ packageId: pkg.id }) : null;
  const fund = contract
    ? await dataSource.getRepository(Fund).findOneBy({ buildingId: contract.buildingId, kind: 'KHAI_THAC' })
    : null;
  const accountant = await actorOf(dataSource, 'KTOAN-A');
  if (!fund?.openingDate || !accountant) return 0;
  if (await dataSource.getRepository(BankStatementImport).exists({ where: { fundId: fund.id } })) return 0;
  const month = addMonthsClamped(`${vnDate(deps.now).slice(0, 7)}-01`, -1).slice(0, 7);
  if (fund.openingDate.slice(0, 7) !== month) return 0;
  const { first, last } = monthBounds(month);
  const day = (n: number): string => `${String(n).padStart(2, '0')}/${month.slice(5)}/${month.slice(0, 4)}`;
  const csv = [
    'Ngày giao dịch,Ghi có,Ghi nợ,Nội dung,Số tham chiếu,Số tài khoản',
    `${day(18)},10000000,,DV-A chuyen tien hop dong HD-001,FT${month.replace('-', '')}18001,${fund.accountNo ?? ''}`,
    `${day(22)},5000000,,DV-A chuyen tien hop dong HD-001,FT${month.replace('-', '')}22001,${fund.accountNo ?? ''}`,
    `${day(22)},,2000000,Nop thue thang ${month.slice(5)},FT${month.replace('-', '')}22002,${fund.accountNo ?? ''}`,
    `${day(23)},,3000000,Chi dich vu ve sinh sanh,FT${month.replace('-', '')}23001,${fund.accountNo ?? ''}`,
  ].join('\r\n');
  await deps.statements.import(accountant, fund.id, {
    periodFrom: first,
    periodTo: last,
    openingBalanceVnd: '50000000',
    closingBalanceVnd: '60000000',
    file: { buffer: Buffer.from(`﻿${csv}\r\n`, 'utf8'), originalname: `sao-ke-${month}.csv`, mimetype: 'text/csv' },
  });
  await deps.reconciliation.confirmSuggestions(accountant, fund.id, month);
  return 1;
};
