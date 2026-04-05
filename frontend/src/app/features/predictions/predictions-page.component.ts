import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NovaApiService } from '../../core/api/nova-api.service';
import { JsonHighlightPipe } from '../../shared/json-highlight.pipe';
import { ML_OUTPUT_DOCS, ML_TARGET_DOCS } from './ml-target-docs';
import {
  TRAINING_COLUMN_DOCS,
  defaultSampleFeatureRow,
} from './training-data-features';

type PredictionsTab = 'console' | 'dataset' | 'targets';

@Component({
  selector: 'app-predictions-page',
  standalone: true,
  imports: [FormsModule, JsonHighlightPipe],
  templateUrl: './predictions-page.component.html',
  styleUrl: './predictions-page.component.scss',
})
export class PredictionsPageComponent implements OnInit {
  private readonly api = inject(NovaApiService);

  readonly trainingColumns = TRAINING_COLUMN_DOCS;
  readonly targetDocs = ML_TARGET_DOCS;
  readonly outputDocs = ML_OUTPUT_DOCS;

  activeTab: PredictionsTab = 'console';

  region = 'EMEA';
  skuRevenue = 'SKU-10042';
  skuStock = 'SKU-10042';

  featureJsonText = '';
  featureJsonError: string | null = null;

  mlHealth: Record<string, unknown> | null = null;
  mlHealthError: string | null = null;

  loadingRev = false;
  loadingStock = false;
  loadingHealth = false;
  errorRev: string | null = null;
  errorStock: string | null = null;
  resultRev: Record<string, unknown> | null = null;
  resultStock: Record<string, unknown> | null = null;

  ngOnInit(): void {
    this.resetFeatureJson();
    this.refreshMlHealth();
  }

  setTab(tab: PredictionsTab): void {
    this.activeTab = tab;
  }

  resetFeatureJson(): void {
    this.featureJsonText = JSON.stringify(defaultSampleFeatureRow(), null, 2);
    this.featureJsonError = null;
  }

  refreshMlHealth(): void {
    this.loadingHealth = true;
    this.mlHealthError = null;
    this.api.getMlHealth().subscribe({
      next: (data) => {
        this.mlHealth = data;
        this.loadingHealth = false;
      },
      error: () => {
        this.mlHealth = null;
        this.mlHealthError =
          'Could not reach ML health (check :8000, Cognito session, and API).';
        this.loadingHealth = false;
      },
    });
  }

  mlEnginesActive(): boolean {
    const m = this.mlHealth?.['models'] as Record<string, unknown> | undefined;
    return !!(m?.['revenueLoaded'] || m?.['stockoutLoaded']);
  }

  typeBadgeClass(type: string): string {
    const t = type.toLowerCase();
    let variant = 'type-badge--def';
    if (t.includes('string') || t === 'text') variant = 'type-badge--str';
    else if (t.includes('int') || t.includes('0/1')) variant = 'type-badge--int';
    else if (t.includes('float') || t.includes('num')) variant = 'type-badge--float';
    else if (t.includes('date')) variant = 'type-badge--date';
    else if (t.includes('—') || t === '—') variant = 'type-badge--dash';
    return `type-badge ${variant}`;
  }

  private parseFeaturePayload(): Record<string, unknown> | null {
    try {
      const o = JSON.parse(this.featureJsonText) as unknown;
      if (o === null || typeof o !== 'object' || Array.isArray(o)) {
        this.featureJsonError = 'JSON root must be a single object (feature row), not an array.';
        return null;
      }
      this.featureJsonError = null;
      return o as Record<string, unknown>;
    } catch {
      this.featureJsonError = 'Invalid JSON — check quotes and trailing commas.';
      return null;
    }
  }

  runRevenue(): void {
    const base = this.parseFeaturePayload();
    if (!base) return;
    this.loadingRev = true;
    this.errorRev = null;
    this.resultRev = null;
    const body = {
      ...base,
      region: this.region,
      sku_id: this.skuRevenue,
      sku: this.skuRevenue,
    };
    this.api.predictRevenue(body).subscribe({
      next: (data) => {
        this.resultRev = data;
        this.loadingRev = false;
        this.refreshMlHealth();
      },
      error: () => {
        this.errorRev =
          'Model call failed — verify ML :8000, joblib on disk/S3, and Nest API.';
        this.loadingRev = false;
      },
    });
  }

  runStockout(): void {
    const base = this.parseFeaturePayload();
    if (!base) return;
    this.loadingStock = true;
    this.errorStock = null;
    this.resultStock = null;
    const body = {
      ...base,
      sku_id: this.skuStock,
      sku: this.skuStock,
    };
    this.api.predictStockout(body).subscribe({
      next: (data) => {
        this.resultStock = data;
        this.loadingStock = false;
        this.refreshMlHealth();
      },
      error: () => {
        this.errorStock = 'Stock-out model call failed — check ML service and API.';
        this.loadingStock = false;
      },
    });
  }

  modelStatusLine(): string {
    const m = this.mlHealth?.['models'] as Record<string, unknown> | undefined;
    if (!m) return '';
    const rev = m['revenueLoaded'] ? 'Revenue: production artifact' : 'Revenue: stub';
    const st = m['stockoutLoaded'] ? 'Stock-out: production artifact' : 'Stock-out: stub';
    return `${rev} · ${st}`;
  }

  s3ModelsLine(): string {
    const snap = this.mlHealth?.['s3'] as Record<string, unknown> | undefined;
    if (!snap) return '';
    const parts: string[] = [];
    const bucketOk = this.mlHealth?.['s3BucketReachable'];
    if (bucketOk === true) parts.push('S3 bucket reachable');
    else if (bucketOk === false) parts.push('S3 bucket unreachable (IAM / region)');
    const r = snap['revenueObjectHeadOk'];
    const s = snap['stockoutObjectHeadOk'];
    if (r === true) parts.push('Revenue object OK');
    else if (r === false) parts.push('Missing revenue key in bucket');
    if (s === true) parts.push('Stock-out object OK');
    else if (s === false) parts.push('Missing stock-out key in bucket');
    const m = this.mlHealth?.['models'] as Record<string, unknown> | undefined;
    const order = m?.['modelOrder'];
    if (order) parts.push(`Load order: ${order}`);
    return parts.join(' · ');
  }

  modelSourcesLine(): string {
    const m = this.mlHealth?.['models'] as Record<string, unknown> | undefined;
    if (!m) return '';
    const rs = m['revenueLoadSource'];
    const ss = m['stockoutLoadSource'];
    const bits: string[] = [];
    if (rs) bits.push(`Revenue ← ${rs}`);
    if (ss) bits.push(`Stock-out ← ${ss}`);
    return bits.join(' · ');
  }
}
