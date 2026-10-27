import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TasksService, type MyTasksView } from './tasks.service';

/**
 * "Công việc của tôi" (SPEC TK-S1). Every signed-in account has it (BR-TK-09); there is no parameter to read another
 * person's tasks.
 */
@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('me/tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'Việc sửa chữa đang chờ tôi, việc đã làm trong 30 ngày và các ô số' })
  mine(@CurrentUser() user: AuthenticatedUser): Promise<MyTasksView> {
    return this.tasks.mine(user);
  }
}
