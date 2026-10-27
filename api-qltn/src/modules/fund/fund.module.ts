import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments/attachments.module';
import { FundController } from './fund.controller';
import { FundLedgerService } from './fund-ledger.service';
import { FundsService } from './funds.service';
import { ReconciliationService } from './reconciliation.service';
import { StatementsController } from './statements.controller';
import { StatementsService } from './statements.service';
import { TaxService } from './tax.service';
import { VouchersService } from './vouchers.service';

/** Funds, the ledger, taxes and vouchers (SPEC F-S3). Kind-neutral: group T adds the maintenance fund on top. */
@Module({
  imports: [AttachmentsModule],
  controllers: [FundController, StatementsController],
  providers: [FundLedgerService, FundsService, TaxService, VouchersService, StatementsService, ReconciliationService],
  exports: [FundLedgerService, FundsService, TaxService, VouchersService],
})
export class FundModule {}
