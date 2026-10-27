import { Module } from '@nestjs/common';
import { FundController } from './fund.controller';
import { FundLedgerService } from './fund-ledger.service';
import { FundsService } from './funds.service';
import { TaxService } from './tax.service';
import { VouchersService } from './vouchers.service';

/** Funds, the ledger, taxes and vouchers (SPEC F-S3). Kind-neutral: group T adds the maintenance fund on top. */
@Module({
  controllers: [FundController],
  providers: [FundLedgerService, FundsService, TaxService, VouchersService],
  exports: [FundLedgerService, FundsService, TaxService, VouchersService],
})
export class FundModule {}
