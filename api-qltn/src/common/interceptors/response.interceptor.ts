import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Shape of every successful JSON response. */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
  correlationId: string | null;
}

/**
 * Wraps controller results in the standard envelope. Files (StreamableFile/Buffer)
 * pass through untouched — wrapping them would JSON-serialise the bytes.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, SuccessResponse<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<SuccessResponse<T> | T> {
    const request = context.switchToHttp().getRequest<Request>();
    const correlationId = request.correlationId ?? null;

    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile || Buffer.isBuffer(data)) return data;
        return { success: true as const, data, timestamp: new Date().toISOString(), correlationId };
      }),
    );
  }
}
