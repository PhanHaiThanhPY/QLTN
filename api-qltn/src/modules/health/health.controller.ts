import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Health')
@Public()
@SkipThrottle()
@Controller('public')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get('health-check')
  async check(): Promise<{ status: 'ok'; database: 'up' | 'down'; uptimeSeconds: number }> {
    const database = await this.dataSource
      .query('SELECT 1')
      .then(() => 'up' as const)
      .catch(() => 'down' as const);
    return { status: 'ok', database, uptimeSeconds: Math.round(process.uptime()) };
  }
}
