import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PredictionRecord } from '../../database/entities/prediction-record.entity';

@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(PredictionRecord)
    private readonly records: Repository<PredictionRecord>,
  ) {}

  async listForUser(userId: string, opts: { limit: number; offset: number }) {
    const [items, total] = await this.records.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: opts.limit,
      skip: opts.offset,
    });
    return { total, items };
  }
}
