import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type PredictionKind = 'revenue' | 'stockout_risk';

@Entity({ name: 'prediction_records' })
export class PredictionRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16 })
  kind: PredictionKind;

  @Column({ type: 'jsonb' })
  requestPayload: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  responsePayload: Record<string, unknown>;

  @Column({ type: 'varchar', length: 128, nullable: true })
  userId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
