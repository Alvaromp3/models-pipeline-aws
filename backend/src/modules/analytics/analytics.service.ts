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
    let revenue = 0;
    let stockout = 0;
    for (const r of rows) {
      const d = r.createdAt.toISOString().slice(0, 10);
      byDay[d] = (byDay[d] ?? 0) + 1;
      if (r.kind === 'revenue') revenue += 1;
      else if (r.kind === 'stockout_risk') stockout += 1;
    }
    const sortedDays = Object.keys(byDay).sort((a, b) => a.localeCompare(b));
    const activeDays = sortedDays.length;
    const lastRunAt =
      rows.length > 0 ? rows[0]!.createdAt.toISOString() : null;
    return {
      volumeByDay: Object.entries(byDay)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      sampleSize: rows.length,
      byKind: { revenue, stockout_risk: stockout },
      activeDays,
      dateRange: {
        start: sortedDays[0] ?? null,
        end: sortedDays[sortedDays.length - 1] ?? null,
      },
      lastRunAt,
    };
  }
}
