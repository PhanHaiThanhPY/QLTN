import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireCapabilities } from '../../common/decorators/require-capabilities.decorator';
import { DepartmentsService, type DepartmentView } from './departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Bộ phận phụ trách các tòa trong phạm vi' })
  list(@CurrentUser() user: AuthenticatedUser): Promise<DepartmentView[]> {
    return this.departments.list(user);
  }

  @Post()
  @RequireCapabilities('ACCOUNT_MANAGE')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDepartmentDto): Promise<DepartmentView> {
    return this.departments.create(user, dto);
  }

  @Patch(':id')
  @RequireCapabilities('ACCOUNT_MANAGE')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentView> {
    return this.departments.update(user, id, dto);
  }
}
