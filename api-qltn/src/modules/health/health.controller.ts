import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
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

  /** Same body either way; 503 when the database does not answer, so load balancers can act on it (AD-S1 BR-08). */
  @Get('health-check')
  async check(
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ status: 'ok'; database: 'up' | 'down'; uptimeSeconds: number }> {
    const database = await this.dataSource
      .query('SELECT 1')
      .then(() => 'up' as const)
      .catch(() => 'down' as const);
    if (database === 'down') response.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status: 'ok', database, uptimeSeconds: Math.round(process.uptime()) };
  }
}
