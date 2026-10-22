import type { LoggerService } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * QLTN log line (same shape as the VANTHANH standard, no external library):
 *   [ISO-timestamp] [QLTN] [<service>] [<LEVEL>] [<context>] <message>
 *   LEVEL: INFO | WARN | ERROR | DEBUG | VERBOSE | HTTP
 */
function format(service: string, level: string, message: unknown, context?: string): string {
  const ts = new Date().toISOString();
  const ctx = context ? ` [${context}]` : '';
  let text: string;
  if (typeof message === 'string') text = message;
  else if (message instanceof Error) text = message.stack || message.message;
  else {
    try {
      text = JSON.stringify(message);
    } catch {
      text = String(message);
    }
  }
  return `[${ts}] [QLTN] [${service}] [${level}]${ctx} ${text}`;
}

const LOG_LEVEL_RANK: Readonly<Record<string, number>> = { ERROR: 0, WARN: 1, INFO: 2, HTTP: 2, DEBUG: 3, VERBOSE: 4 };

function enabled(level: string): boolean {
  const configured = (process.env.CONFIG_LOGGER_LEVEL || 'INFO').toUpperCase();
  const minimum = LOG_LEVEL_RANK[configured] ?? LOG_LEVEL_RANK.INFO;
  return (LOG_LEVEL_RANK[level] ?? LOG_LEVEL_RANK.INFO) <= minimum;
}

/** Replaces Nest's default logger via app.useLogger(new QltnLogger('<service>')). */
export class QltnLogger implements LoggerService {
  constructor(private readonly service: string) {}

  log(message: unknown, context?: string) {
    if (enabled('INFO')) console.log(format(this.service, 'INFO', message, context));
  }
  error(message: unknown, stack?: string, context?: string) {
    console.error(format(this.service, 'ERROR', message, context));
    if (stack) console.error(format(this.service, 'ERROR', stack, context));
  }
  warn(message: unknown, context?: string) {
    console.warn(format(this.service, 'WARN', message, context));
  }
  debug(message: unknown, context?: string) {
    if (enabled('DEBUG')) console.debug(format(this.service, 'DEBUG', message, context));
  }
  verbose(message: unknown, context?: string) {
    if (enabled('VERBOSE')) console.log(format(this.service, 'VERBOSE', message, context));
  }
}

function httpLevel(status: number): 'ERROR' | 'WARN' | 'HTTP' {
  if (status >= 500) return 'ERROR';
  if (status >= 400) return 'WARN';
  return 'HTTP';
}

/** Logs every HTTP request: [ts] [QLTN] [<service>] [HTTP] <METHOD> <url> <status> <ms>ms. 4xx → WARN, 5xx → ERROR. */
export function httpLogger(service: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const level = httpLevel(res.statusCode);
      const msg = `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`;
      const out = format(service, level, msg);
      if (level === 'ERROR') console.error(out);
      else if (level === 'WARN') console.warn(out);
      else if (enabled('HTTP')) console.log(out);
    });
    next();
  };
}
