import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { getApiBase } from '../api-url';

export type DashboardSummary = {
  kpis: {
    totalPredictions: number;
    revenueRuns: number;
    stockoutRuns: number;
  };
  recentActivity: PredictionRecordDto[];
};

export type PredictionRecordDto = {
  id: string;
  kind: string;
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown>;
  userId: string | null;
  createdAt: string;
};

export type HistoryResponse = {
  total: number;
  items: PredictionRecordDto[];
};

export type AnalyticsAggregates = {
  volumeByDay: { date: string; count: number }[];
  sampleSize: number;
  byKind?: { revenue: number; stockout_risk: number };
  activeDays?: number;
  dateRange?: { start: string | null; end: string | null };
  lastRunAt?: string | null;
};

export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
};

export type ExplainPredictionResponse = {
  explanation: string | null;
  skippedReason?: string;
  error?: string;
};

export type ModelFeatureMetadata = {
  revenue_features: string[];
  stockout_features: string[];
};

@Injectable({ providedIn: 'root' })
export class NovaApiService {
  private readonly http = inject(HttpClient);

  private base(): string {
    return getApiBase();
  }

  getDashboardSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.base()}/dashboard/summary`);
  }

  getMlHealth(): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${this.base()}/predictions/ml-health`);
  }

  getModelFeatures(): Observable<ModelFeatureMetadata> {
    return this.http.get<ModelFeatureMetadata>(`${this.base()}/predictions/model-features`);
  }

  predictRevenue(body: Record<string, unknown>): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base()}/predictions/revenue`,
      body,
    );
  }

  predictStockout(body: Record<string, unknown>): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(
      `${this.base()}/predictions/stockout-risk`,
      body,
    );
  }

  explainPrediction(body: {
    kind: 'revenue' | 'stockout_risk';
    result: Record<string, unknown>;
    context?: Record<string, unknown>;
  }): Observable<ExplainPredictionResponse> {
    return this.http.post<ExplainPredictionResponse>(`${this.base()}/predictions/explain`, body);
  }

  getHistory(limit: number, offset: number): Observable<HistoryResponse> {
    return this.http.get<HistoryResponse>(`${this.base()}/history`, {
      params: { limit: String(limit), offset: String(offset) },
    });
  }

  getAnalytics(): Observable<AnalyticsAggregates> {
    return this.http.get<AnalyticsAggregates>(`${this.base()}/analytics/aggregates`);
  }

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.base()}/settings/profile`);
  }
}
