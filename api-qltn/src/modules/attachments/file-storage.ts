import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';

const KEY_PATTERN = /^[a-zA-Z0-9-]{8,200}$/;

/**
 * Minimal file store behind `STORAGE_DIR`: write/read/remove by key.
 * The rest of the code knows nothing about disks, so a later S3 backend only replaces this class.
 */
@Injectable()
export class FileStorage {
  private readonly logger = new Logger(FileStorage.name);
  private readonly directory: string;

  constructor(config: ConfigService) {
    const configured = config.get<string>('storage.dir') ?? 'storage';
    this.directory = path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
  }

  /** Absolute directory holding the files (tests clean it up). */
  get root(): string {
    return this.directory;
  }

  async save(key: string, content: Buffer): Promise<void> {
    const target = this.pathOf(key);
    await fs.mkdir(this.directory, { recursive: true });
    await fs.writeFile(target, content);
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.pathOf(key));
  }

  /** Best-effort delete; a missing file is not an error (the row is what matters). */
  async remove(key: string): Promise<void> {
    try {
      await fs.unlink(this.pathOf(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Could not delete stored file ${key}: ${(error as Error).message}`);
      }
    }
  }

  private pathOf(key: string): string {
    if (!KEY_PATTERN.test(key)) throw new Error(`Invalid storage key: ${key}`);
    return path.join(this.directory, key);
  }
}
