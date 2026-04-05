import { IsIn, IsObject, IsOptional } from 'class-validator';

export class ExplainPredictionDto {
  @IsIn(['revenue', 'stockout_risk'])
  kind!: 'revenue' | 'stockout_risk';

  @IsObject()
  result!: Record<string, unknown>;

  /** Región, SKU u otros metadatos no sensibles para contextualizar la narrativa. */
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
