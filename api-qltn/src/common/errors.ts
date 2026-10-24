import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

export const notFound = (message = 'Không tìm thấy dữ liệu yêu cầu.') =>
  new NotFoundException({ code: 'NOT_FOUND', message });

export const forbidden = (message = 'Bạn không có quyền thực hiện thao tác này.') =>
  new ForbiddenException({ code: 'FORBIDDEN', message });

/** Business refusal with a stable machine-readable reason (`details.reason`, snake_case). */
export const forbiddenWithReason = (reason: string, message: string) =>
  new ForbiddenException({ code: 'FORBIDDEN', message, details: { reason } });

/** Request refused before it reaches a business rule; the screen reads `details.reason`. */
export const badRequestWithReason = (reason: string, message: string) =>
  new BadRequestException({ code: 'VALIDATION_ERROR', message, details: { reason } });

export const conflict = (message = 'Dữ liệu đã được người khác cập nhật. Vui lòng tải lại trước khi lưu.') =>
  new ConflictException({ code: 'CONFLICT', message });

/** Optimistic lock: the client must send the version it loaded. */
export function assertVersion(current: number, expected: number): void {
  if (current !== expected) throw conflict();
}
