import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { type ReferenceData, ReferenceService } from './reference.service';

@ApiTags('Reference')
@ApiBearerAuth()
@Controller('reference')
export class ReferenceController {
  constructor(private readonly reference: ReferenceService) {}

  @Get()
  @ApiOperation({ summary: 'Danh mục tra cứu (tòa, bộ phận, vị trí, người dùng) trong phạm vi' })
  get(@CurrentUser() user: AuthenticatedUser): Promise<ReferenceData> {
    return this.reference.get(user);
  }
}
