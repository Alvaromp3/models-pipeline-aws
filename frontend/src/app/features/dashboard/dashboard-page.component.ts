import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  DashboardSummary,
  NovaApiService,
} from '../../core/api/nova-api.service';
import { JsonHighlightPipe } from '../../shared/json-highlight.pipe';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [DatePipe, JsonHighlightPipe],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
})
export class DashboardPageComponent implements OnInit {
  private readonly api = inject(NovaApiService);

  loading = true;
  error: string | null = null;
  summary: DashboardSummary | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.api.getDashboardSummary().subscribe({
      next: (data) => {
        this.summary = data;
        this.loading = false;
      },
      error: () => {
        this.error = 'Could not load dashboard — verify API and session.';
        this.loading = false;
      },
    });
  }

  formatKind(kind: string): string {
    if (kind === 'revenue') return 'Revenue';
    if (kind === 'stockout_risk') return 'Stock-out';
    return kind;
  }

  pillClass(kind: string): string {
    if (kind === 'revenue') return 'pill pill--corp';
    if (kind === 'stockout_risk') return 'pill pill--violet';
    return 'pill pill--neutral';
  }
}
