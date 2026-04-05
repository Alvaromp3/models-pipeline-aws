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
};

export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
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
