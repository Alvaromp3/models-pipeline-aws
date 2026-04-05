import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PredictionRecord } from '../../database/entities/prediction-record.entity';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    @InjectRepository(PredictionRecord)
    private readonly records: Repository<PredictionRecord>,
  ) {}

  @Get('export-summary')
  async exportSummary(@Req() req: Request) {
    const user = req.user as { id: string };
    const [items, total] = await this.records.findAndCount({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
      take: 1000,
    });
    return {
      generatedAt: new Date().toISOString(),
      totalRecords: total,
      rows: items.map((r) => ({
        id: r.id,
        kind: r.kind,
        createdAt: r.createdAt,
        requestPayload: r.requestPayload,
        responsePayload: r.responsePayload,
      })),
    };
  }
}
