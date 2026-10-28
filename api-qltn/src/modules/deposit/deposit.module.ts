import { Module } from '@nestjs/common';
import { DepositBanksService } from './deposit-banks.service';
import { DepositDeadlinesService } from './deposit-deadlines.service';
import { DepositInvitationsService } from './deposit-invitations.service';
import { DepositOffersService } from './deposit-offers.service';
import { DepositSelectionsService } from './deposit-selections.service';
import { DepositController } from './deposit.controller';

/** Group T, maintenance fund deposits: T-S1 rate invitations and the selected bank. */
@Module({
  controllers: [DepositController],
  providers: [
    DepositBanksService,
    DepositInvitationsService,
    DepositOffersService,
    DepositSelectionsService,
    DepositDeadlinesService,
  ],
  exports: [
    DepositBanksService,
    DepositInvitationsService,
    DepositOffersService,
    DepositSelectionsService,
    DepositDeadlinesService,
  ],
})
export class DepositModule {}
