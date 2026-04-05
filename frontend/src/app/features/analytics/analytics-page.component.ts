import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NovaApiService } from '../../core/api/nova-api.service';

@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './analytics-page.component.html',
  styleUrl: './analytics-page.component.scss',
})
export class AnalyticsPageComponent implements OnInit {
  private readonly api = inject(NovaApiService);

  loading = true;
  error: string | null = null;
  maxCount = 1;
  data: { date: string; count: number }[] = [];
  sampleSize = 0;
  revenueRuns = 0;
  stockoutRuns = 0;
  activeDays = 0;
  dateStart: string | null = null;
  dateEnd: string | null = null;
  lastRunAt: string | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.api.getAnalytics().subscribe({
      next: (agg) => {
        this.data = agg.volumeByDay;
        this.sampleSize = agg.sampleSize;
        this.maxCount = Math.max(1, ...this.data.map((d) => d.count));
        const bk = agg.byKind;
        this.revenueRuns = bk?.revenue ?? 0;
        this.stockoutRuns = bk?.stockout_risk ?? 0;
        this.activeDays = agg.activeDays ?? this.data.length;
        this.dateStart = agg.dateRange?.start ?? null;
        this.dateEnd = agg.dateRange?.end ?? null;
        this.lastRunAt = agg.lastRunAt ?? null;
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudo cargar la analítica.';
        this.loading = false;
      },
    });
  }

  barHeight(count: number): string {
    return `${(count / this.maxCount) * 100}%`;
  }

  get yTickValues(): number[] {
    const m = this.maxCount;
    const n = 5;
    return Array.from({ length: n }, (_, i) =>
      Math.round((m * (n - 1 - i)) / (n - 1)),
    );
  }

  avgPerDay(): number {
    if (this.activeDays < 1) return 0;
    return this.sampleSize / this.activeDays;
  }

  /** Porcentaje revenue para gráfico circular (0–100). */
  revenueSharePercent(): number {
    const t = this.revenueRuns + this.stockoutRuns;
    if (t === 0) return 50;
    return Math.round((100 * this.revenueRuns) / t);
  }

  /** Gradiente cónico para donut CSS. */
  donutGradient(): string {
    const p = this.revenueSharePercent();
    return `conic-gradient(
      #0047ab 0% ${p}%,
      #7c4ddb ${p}% 100%
    )`;
  }

  sparseSeries(): boolean {
    return this.data.length <= 2;
  }
}
