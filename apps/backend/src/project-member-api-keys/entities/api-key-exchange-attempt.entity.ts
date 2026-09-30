import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('api_key_exchange_attempts')
@Index('idx_api_key_exchange_attempt_bucket_scope', ['bucketStart', 'ipHash', 'scopeKey'], {
  unique: true,
})
@Index('idx_api_key_exchange_attempt_created_at', ['createdAt'])
export class ApiKeyExchangeAttempt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'datetime' })
  bucketStart: Date;

  @Column({ type: 'varchar', length: 64 })
  ipHash: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  apiKeyIdHash: string | null;

  /** `ip` for the IP-wide bucket, or `key:<HMAC>` for the per-key bucket. */
  @Column({ type: 'varchar', length: 72 })
  scopeKey: string;

  @Column({ type: 'int', default: 0 })
  failedAttempts: number;

  @Column({ type: 'datetime', nullable: true })
  blockedUntil: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}
