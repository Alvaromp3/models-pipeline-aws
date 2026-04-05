import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PredictionRecord } from '../../database/entities/prediction-record.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(PredictionRecord)
    private readonly records: Repository<PredictionRecord>,
  ) {}

  async aggregates(userId: string) {
    const rows = await this.records.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 500,
    });
    const byDay: Record<string, number> = {};
    for (const r of rows) {
      const d = r.createdAt.toISOString().slice(0, 10);
      byDay[d] = (byDay[d] ?? 0) + 1;
    }
    return {
      volumeByDay: Object.entries(byDay)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      sampleSize: rows.length,
    };
  }
}
