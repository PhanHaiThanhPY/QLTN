import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { fieldLabel } from '../validation/field-labels';

/** Shape of every error response. */
export interface ErrorResponse {
  success: false;
  error: { code: string; message: string; details: unknown };
  timestamp: string;
  correlationId: string | null;
}

interface MappedError {
  status: number;
  code: string;
  message: string;
  details: unknown;
}

const STATUS_CODES: Readonly<Record<number, string>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
};

const STATUS_MESSAGES: Readonly<Record<number, string>> = {
  401: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy dữ liệu yêu cầu.',
  429: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.',
};

const FRAMEWORK_MESSAGES: Readonly<Record<string, string>> = {
  'Validation failed (uuid is expected)': 'Mã định danh trong đường dẫn không hợp lệ.',
  'Validation failed (numeric string is expected)': 'Giá trị số trong đường dẫn không hợp lệ.',
  Unauthorized: STATUS_MESSAGES[401],
  Forbidden: 'Bạn không có quyền thực hiện thao tác này.',
};

const SERVER_FAULT = 'Hệ thống gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại; nếu vẫn lỗi, báo quản trị kèm mã tra cứu.';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const stringField = (body: Record<string, unknown>, key: string): string | undefined =>
  typeof body[key] === 'string' ? body[key] : undefined;

/** Columns from a Postgres unique violation: `Key (code)=(…)` → ['code']. Values are dropped. */
function duplicateColumns(detail: unknown): string[] {
  if (typeof detail !== 'string') return [];
  const match = detail.match(/Key \(([^)]+)\)=/);
  return match ? match[1].split(',').map((c) => c.trim().replace(/^"|"$/g, '')) : [];
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const correlationId = request.correlationId ?? null;

    const mapped = this.map(exception, correlationId);
    const body: ErrorResponse = {
      success: false,
      error: { code: mapped.code, message: mapped.message, details: mapped.details },
      timestamp: new Date().toISOString(),
      correlationId,
    };
    response.status(mapped.status).json(body);
  }

  private map(exception: unknown, correlationId: string | null): MappedError {
    if (exception instanceof HttpException) return this.mapHttp(exception);
    if (exception instanceof QueryFailedError)
      return this.mapQuery(exception as QueryFailedError<Error>, correlationId);

    const reference = correlationId ? ` Mã tra cứu: ${correlationId}.` : '';
    if (exception instanceof Error) {
      this.logger.error(`[${correlationId}] Unhandled exception: ${exception.message}`, exception.stack);
    } else {
      this.logger.error(`[${correlationId}] Unhandled non-Error exception: ${String(exception)}`);
    }
    return { status: 500, code: 'INTERNAL_SERVER_ERROR', message: SERVER_FAULT + reference, details: null };
  }

  private mapHttp(exception: HttpException): MappedError {
    const status = exception.getStatus();
    const raw = exception.getResponse();
    const fallbackCode = STATUS_CODES[status] ?? (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR');

    if (!isRecord(raw)) {
      const message = typeof raw === 'string' ? raw : exception.message;
      return { status, code: fallbackCode, message: FRAMEWORK_MESSAGES[message] ?? message, details: null };
    }

    const code = stringField(raw, 'code') ?? fallbackCode;
    const rawMessage = Array.isArray(raw.message) ? String(raw.message[0]) : stringField(raw, 'message');
    // Unknown routes come back from Express as "Cannot GET /path".
    const routeMissing = status === 404 && rawMessage?.startsWith('Cannot ');
    const message =
      rawMessage && !routeMissing
        ? (FRAMEWORK_MESSAGES[rawMessage] ?? rawMessage)
        : (STATUS_MESSAGES[status] ?? exception.message);
    return { status, code, message, details: raw.details ?? null };
  }

  private mapQuery(exception: QueryFailedError<Error>, correlationId: string | null): MappedError {
    const driver: Record<string, unknown> = isRecord(exception.driverError) ? exception.driverError : {};
    const pgCode = stringField(driver, 'code');
    this.logger.error(`[${correlationId}] DB error ${pgCode ?? '?'}: ${exception.message}`, exception.stack);

    switch (pgCode) {
      case '23505': {
        const columns = duplicateColumns(driver.detail);
        return {
          status: HttpStatus.CONFLICT,
          code: 'DUPLICATE',
          message: columns.length
            ? `Dữ liệu đã tồn tại: trùng ${columns.map(fieldLabel).join(', ')}.`
            : 'Dữ liệu đã tồn tại (trùng giá trị duy nhất).',
          details: columns.length ? { fields: columns } : null,
        };
      }
      case '23503':
        return { status: 400, code: 'FK_VIOLATION', message: 'Tham chiếu không hợp lệ (khoá ngoại).', details: null };
      case '23502': {
        const column = stringField(driver, 'column');
        return {
          status: 400,
          code: 'NOT_NULL',
          message: column ? `Thiếu ${fieldLabel(column)} (bắt buộc).` : 'Thiếu trường bắt buộc.',
          details: column ? { field: column } : null,
        };
      }
      case '22007':
      case '22008':
      case '22P02':
        return {
          status: 400,
          code: 'INVALID_VALUE',
          message: 'Giá trị không hợp lệ (ngày, số hoặc mã sai định dạng).',
          details: null,
        };
      default: {
        const reference = correlationId ? ` Mã tra cứu: ${correlationId}.` : '';
        return { status: 500, code: 'DB_ERROR', message: SERVER_FAULT + reference, details: null };
      }
    }
  }
}
