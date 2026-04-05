import { Component, OnInit, inject } from '@angular/core';
import { NovaApiService } from '../../core/api/nova-api.service';

@Component({
  selector: 'app-analytics-page',
  standalone: true,
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

  /** Etiquetas eje Y (densidad analítica). */
  get yTicks(): string[] {
    const m = this.maxCount;
    return [String(m), String(Math.round(m * 0.66)), String(Math.round(m * 0.33)), '0'];
  }
}
