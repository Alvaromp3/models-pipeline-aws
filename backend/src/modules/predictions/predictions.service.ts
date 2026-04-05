import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import {
  PredictionRecord,
  PredictionKind,
} from '../../database/entities/prediction-record.entity';

@Injectable()
export class PredictionsService {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    @InjectRepository(PredictionRecord)
    private readonly records: Repository<PredictionRecord>,
  ) {}

  private mlBase() {
    return this.config.get<string>('mlServiceUrl') ?? 'http://localhost:8000';
  }

  async mlHealth(): Promise<Record<string, unknown>> {
    const url = `${this.mlBase()}/health`;
    const res = await firstValueFrom(
      this.http.get<Record<string, unknown>>(url, { timeout: 10_000 }),
    );
    return res.data;
  }

  async predictRevenue(body: Record<string, unknown>, userId: string | null) {
    const url = `${this.mlBase()}/predict/revenue`;
    const res = await firstValueFrom(
      this.http.post<Record<string, unknown>>(url, body, { timeout: 30_000 }),
    );
    await this.saveRecord('revenue', body, res.data, userId);
    return res.data;
  }

  async predictStockout(body: Record<string, unknown>, userId: string | null) {
    const url = `${this.mlBase()}/predict/stockout-risk`;
    const res = await firstValueFrom(
      this.http.post<Record<string, unknown>>(url, body, { timeout: 30_000 }),
    );
    await this.saveRecord('stockout_risk', body, res.data, userId);
    return res.data;
  }

  private async saveRecord(
    kind: PredictionKind,
    requestPayload: Record<string, unknown>,
    responsePayload: Record<string, unknown>,
    userId: string | null,
  ) {
    const row = this.records.create({
      kind,
      requestPayload,
      responsePayload,
      userId,
    });
    await this.records.save(row);
  }
}
