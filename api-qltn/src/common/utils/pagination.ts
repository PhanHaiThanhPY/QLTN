import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { PaginatedResult } from '../interfaces/paginated.interface';

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

/** Query DTO for list endpoints: `?page=1&limit=20`. */
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: DEFAULT_PAGE_LIMIT, minimum: 1, maximum: MAX_PAGE_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit?: number;
}

export interface PageWindow {
  page: number;
  limit: number;
  skip: number;
}

export function pageWindow(query: PaginationQueryDto): PageWindow {
  const page = query.page ?? 1;
  const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
  return { page, limit, skip: (page - 1) * limit };
}

export function toPaginated<T>(data: T[], total: number, window: PageWindow): PaginatedResult<T> {
  return {
    data,
    meta: { page: window.page, limit: window.limit, total, totalPages: Math.ceil(total / window.limit) },
  };
}
