import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  NovaApiService,
  PredictionRecordDto,
} from '../../core/api/nova-api.service';
import { JsonHighlightPipe } from '../../shared/json-highlight.pipe';

@Component({
  selector: 'app-history-page',
  standalone: true,
  imports: [DatePipe, JsonHighlightPipe],
  templateUrl: './history-page.component.html',
  styleUrl: './history-page.component.scss',
})
export class HistoryPageComponent implements OnInit {
  private readonly api = inject(NovaApiService);

  readonly pageSize = 20;
  offset = 0;
  total = 0;
  items: PredictionRecordDto[] = [];
  loading = true;
  error: string | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.api.getHistory(this.pageSize, this.offset).subscribe({
      next: (res) => {
        this.items = res.items;
        this.total = res.total;
        this.loading = false;
      },
      error: () => {
        this.error = 'Could not load history.';
        this.loading = false;
      },
    });
  }

  next(): void {
    if (this.offset + this.pageSize < this.total) {
      this.offset += this.pageSize;
      this.load();
    }
  }

  prev(): void {
    if (this.offset > 0) {
      this.offset = Math.max(0, this.offset - this.pageSize);
      this.load();
    }
  }

  get pageLabel(): string {
    const start = this.total === 0 ? 0 : this.offset + 1;
    const end = Math.min(this.offset + this.items.length, this.total);
    return `${start}–${end} of ${this.total}`;
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
