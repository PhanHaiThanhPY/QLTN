import { Injectable } from '@nestjs/common';

/** "Now" of business rules that compare with deadlines (F-S1); tests fix it, the server uses the real time. */
@Injectable()
export class Clock {
  private fixed: Date | null = null;

  now(): Date {
    return this.fixed ? new Date(this.fixed) : new Date();
  }

  /** Tests only: pins "now" (null returns to the real time). */
  set(at: Date | null): void {
    this.fixed = at ? new Date(at) : null;
  }
}
