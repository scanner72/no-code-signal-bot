import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type ConnectionType = 'telegram_bot' | 'discord_webhook' | 'generic_webhook';

// Secret material (bot tokens, webhook urls) lives ONLY here, encrypted at
// rest. Canvas nodes reference a connection by id, so exported strategy JSON
// never contains secrets.
@Entity('connections')
export class Connection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'text', nullable: true })
  user_id: string | null;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 40 })
  type: ConnectionType;

  // AES-256-GCM encrypted JSON, format "v1:<iv>:<tag>:<ciphertext>" (base64 parts)
  @Column({ type: 'text' })
  config: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
