import { ArgumentsHost, BadRequestException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { GlobalExceptionFilter, type ErrorResponse } from './global-exception.filter';

function run(exception: unknown): { status: number; body: ErrorResponse } {
  const captured: { status: number; body?: ErrorResponse } = { status: 0 };
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: ErrorResponse) {
      captured.body = body;
    },
  };
  const host = {
    switchToHttp: () => ({ getRequest: () => ({ correlationId: 'corr-12345678' }), getResponse: () => response }),
  } as unknown as ArgumentsHost;
  new GlobalExceptionFilter().catch(exception, host);
  if (!captured.body) throw new Error('filter did not respond');
  return { status: captured.status, body: captured.body };
}

const pgError = (driverError: Record<string, string>) =>
  new QueryFailedError('INSERT ...', [], Object.assign(new Error('pg'), driverError));

describe('GlobalExceptionFilter', () => {
  beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));

  it('keeps code, message and details of a structured HttpException', () => {
    const { status, body } = run(
      new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Sai', details: { fields: [] } }),
    );
    expect(status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Sai', details: { fields: [] } },
      correlationId: 'corr-12345678',
    });
  });

  it('translates framework default messages', () => {
    const { status, body } = run(new ForbiddenException());
    expect(status).toBe(403);
    expect(body.error).toEqual({
      code: 'FORBIDDEN',
      message: 'Bạn không có quyền thực hiện thao tác này.',
      details: null,
    });
  });

  it('translates the router 404 for unknown routes', () => {
    const { status, body } = run(new NotFoundException('Cannot GET /api/nope'));
    expect(status).toBe(404);
    expect(body.error.message).toBe('Không tìm thấy dữ liệu yêu cầu.');
  });

  it('maps a unique violation to 409 DUPLICATE without leaking the value', () => {
    const { status, body } = run(pgError({ code: '23505', detail: 'Key (username)=(bql-a) already exists.' }));
    expect(status).toBe(409);
    expect(body.error).toEqual({
      code: 'DUPLICATE',
      message: 'Dữ liệu đã tồn tại: trùng Tên đăng nhập.',
      details: { fields: ['username'] },
    });
    expect(JSON.stringify(body)).not.toContain('bql-a');
  });

  it('hides internals of unexpected errors and returns the lookup reference', () => {
    const { status, body } = run(new Error('connection string postgres://secret'));
    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(body.error.message).toContain('corr-12345678');
    expect(JSON.stringify(body)).not.toContain('secret');
  });
});
