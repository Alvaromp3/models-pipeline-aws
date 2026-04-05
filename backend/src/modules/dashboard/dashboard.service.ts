import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PredictionRecord } from '../../database/entities/prediction-record.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(PredictionRecord)
    private readonly records: Repository<PredictionRecord>,
  ) {}

  async summary(userId: string) {
    const total = await this.records.count({ where: { userId } });
    const revenue = await this.records.count({
      where: { userId, kind: 'revenue' },
    });
    const stockout = await this.records.count({
      where: { userId, kind: 'stockout_risk' },
    });
    const last = await this.records.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 5,
    });
    return {
      kpis: {
        totalPredictions: total,
        revenueRuns: revenue,
        stockoutRuns: stockout,
      },
      recentActivity: last,
    };
  }
}
