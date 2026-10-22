import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/** One issued refresh token. Only the SHA-256 hash is stored, so a database leak does not leak sessions. */
@Entity('refresh_tokens')
@Index('UQ_refresh_tokens_hash', ['tokenHash'], { unique: true })
@Index('IDX_refresh_tokens_user', ['userId'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_refresh_tokens_user' })
  user: User;

  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  /** Token issued when this one was rotated; set together with revokedAt. */
  @Column({ name: 'replaced_by', type: 'uuid', nullable: true })
  replacedBy: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 300, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
