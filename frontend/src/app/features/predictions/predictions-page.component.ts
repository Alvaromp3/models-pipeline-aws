import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NovaApiService } from '../../core/api/nova-api.service';
import { JsonHighlightPipe } from '../../shared/json-highlight.pipe';
import { PredictFeatureFieldComponent } from './predict-feature-field.component';
import { PredictionFieldHelperComponent } from './prediction-field-helper.component';
import { PredictionFieldHelperContext } from './prediction-field-helper.context';
import { ML_OUTPUT_DOCS, ML_TARGET_DOCS } from './ml-target-docs';
import {
  buildStrictModelPayload,
  normalizeMetadataPayload,
  sameFeatureSchema,
  seedValuesForFeatures,
} from './prediction-dynamic-form';
import { TRAINING_COLUMN_DOCS } from './training-data-features';

type PredictionsTab = 'console' | 'dataset' | 'targets';

@Component({
  selector: 'app-predictions-page',
  standalone: true,
  imports: [
    FormsModule,
    JsonHighlightPipe,
    PredictFeatureFieldComponent,
    PredictionFieldHelperComponent,
  ],
  templateUrl: './predictions-page.component.html',
  styleUrl: './predictions-page.component.scss',
  providers: [PredictionFieldHelperContext],
})
export class PredictionsPageComponent implements OnInit {
  private readonly api = inject(NovaApiService);
  private readonly fieldHelper = inject(PredictionFieldHelperContext);

  readonly trainingColumns = TRAINING_COLUMN_DOCS;
  readonly targetDocs = ML_TARGET_DOCS;
  readonly outputDocs = ML_OUTPUT_DOCS;
  activeTab: PredictionsTab = 'console';

  /** Columns from joblib `feature_names_in_` (targets stripped defensively). */
  revenueFeatures: string[] = [];
  stockoutFeatures: string[] = [];
  shareableSchema = false;

  valuesShared: Record<string, string> = {};
  valuesRevenue: Record<string, string> = {};
  valuesStockout: Record<string, string> = {};

  mlHealth: Record<string, unknown> | null = null;
  mlHealthError: string | null = null;
  loadingFeatures = false;
  featuresError: string | null = null;

  loadingRev = false;
  loadingStock = false;
  loadingHealth = false;
  errorRev: string | null = null;
  errorStock: string | null = null;
  resultRev: Record<string, unknown> | null = null;
  resultStock: Record<string, unknown> | null = null;

  explainRev: string | null = null;
  explainStock: string | null = null;
  explainRevNote: string | null = null;
  explainStockNote: string | null = null;

  ngOnInit(): void {
    this.fieldHelper.registerPickHandler((ref, value) => {
      const map =
        ref.scope === 'shared'
          ? this.valuesShared
          : ref.scope === 'rev'
            ? this.valuesRevenue
            : this.valuesStockout;
      map[ref.feature] = value;
    });
    this.refreshMlHealth();
    this.refreshModelFeatures();
  }

  setTab(tab: PredictionsTab): void {
    this.activeTab = tab;
  }

  initValueMaps(): void {
    if (this.shareableSchema) {
      this.valuesShared = seedValuesForFeatures(this.revenueFeatures);
      this.valuesRevenue = {};
      this.valuesStockout = {};
    } else {
      this.valuesShared = {};
      this.valuesRevenue = seedValuesForFeatures(this.revenueFeatures);
      this.valuesStockout = seedValuesForFeatures(this.stockoutFeatures);
    }
  }

  resetScenario(): void {
    this.initValueMaps();
  }

  refreshModelFeatures(): void {
    this.loadingFeatures = true;
    this.featuresError = null;
    this.api.getModelFeatures().subscribe({
      next: (raw) => {
        const m = normalizeMetadataPayload(raw);
        this.revenueFeatures = m.revenue_features;
        this.stockoutFeatures = m.stockout_features;
        this.shareableSchema = sameFeatureSchema(this.revenueFeatures, this.stockoutFeatures);
        this.initValueMaps();
        this.loadingFeatures = false;
      },
      error: (err: unknown) => {
        this.featuresError = this.schemaLoadErrorMessage(err);
        this.revenueFeatures = [];
        this.stockoutFeatures = [];
        this.shareableSchema = false;
        this.valuesShared = {};
        this.valuesRevenue = {};
        this.valuesStockout = {};
        this.loadingFeatures = false;
      },
    });
  }

  refreshAll(): void {
    this.refreshMlHealth();
    this.refreshModelFeatures();
  }

  payloadRevenue(): Record<string, unknown> {
    const src = this.valueSourceRevenue();
    return buildStrictModelPayload(this.revenueFeatures, src);
  }

  payloadStockout(): Record<string, unknown> {
    const src = this.valueSourceStockout();
    return buildStrictModelPayload(this.stockoutFeatures, src);
  }

  payloadJsonRevenue(): string {
    return JSON.stringify(this.payloadRevenue(), null, 2);
  }

  payloadJsonStockout(): string {
    return JSON.stringify(this.payloadStockout(), null, 2);
  }

  payloadJsonShared(): string {
    return JSON.stringify(this.payloadRevenue(), null, 2);
  }

  private valueSourceRevenue(): Record<string, string> {
    return this.shareableSchema ? this.valuesShared : this.valuesRevenue;
  }

  private valueSourceStockout(): Record<string, string> {
    return this.shareableSchema ? this.valuesShared : this.valuesStockout;
  }

  /** Mensaje cuando falla GET /api/predictions/model-features (proxy a ML /metadata/features). */
  private schemaLoadErrorMessage(err: unknown): string {
    const base =
      'Could not load model input schema (Nest → ML /metadata/features). ';
    if (err instanceof HttpErrorResponse) {
      if (err.status === 401 || err.status === 403) {
        return base + 'Session expired or forbidden — sign in again.';
      }
      if (err.status === 0) {
        return base + 'Network error — is the API running and is the dev proxy OK?';
      }
      if (err.status >= 500) {
        return (
          base +
          `Server error (HTTP ${err.status}). The first schema request downloads full joblibs from S3 and can take a long time — restart the API after the backend change (120s ML timeout) and click Refresh.`
        );
      }
      return base + `HTTP ${err.status}.`;
    }
    return base + 'Check ML :8000, ML_SERVICE_URL in the API, and credentials.';
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

  runRevenue(): void {
    const body = this.payloadRevenue();
    this.loadingRev = true;
    this.errorRev = null;
    this.resultRev = null;
    this.explainRev = null;
    this.explainRevNote = null;
    this.api.predictRevenue(body).subscribe({
      next: (data) => {
        const split = this.splitMlAndNarrative(data);
        this.resultRev = split.ml;
        this.explainRev = split.narrative;
        this.explainRevNote = split.narrativeError;
        this.loadingRev = false;
        this.refreshMlHealth();
      },
      error: () => {
        this.errorRev =
          'Revenue model call failed — verify ML :8000, joblib on disk/S3, and Nest API.';
        this.loadingRev = false;
      },
    });
  }

  runStockout(): void {
    const body = this.payloadStockout();
    this.loadingStock = true;
    this.errorStock = null;
    this.resultStock = null;
    this.explainStock = null;
    this.explainStockNote = null;
    this.api.predictStockout(body).subscribe({
      next: (data) => {
        const split = this.splitMlAndNarrative(data);
        this.resultStock = split.ml;
        this.explainStock = split.narrative;
        this.explainStockNote = split.narrativeError;
        this.loadingStock = false;
        this.refreshMlHealth();
      },
      error: () => {
        this.errorStock =
          'Stock-out model call failed — check ML service and API.';
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
    if (r === true) parts.push('Revenue model object OK');
    else if (r === false) parts.push('Missing revenue model key in bucket');
    if (s === true) parts.push('Stock-out model object OK');
    else if (s === false) parts.push('Missing stock-out model key in bucket');
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

  s3StatusItems(): string[] {
    const line = this.s3ModelsLine();
    return line ? line.split(' · ').map((s) => s.trim()).filter(Boolean) : [];
  }

  schemaSummaryLine(): string {
    const r = this.revenueFeatures.length;
    const s = this.stockoutFeatures.length;
    if (r === 0 && s === 0) {
      return 'No feature list reported (stubs or models without feature_names_in_).';
    }
    if (this.shareableSchema) {
      return `Shared input schema · ${r} feature(s) for both models.`;
    }
    return `Revenue: ${r} feature(s) · Stock-out: ${s} feature(s) (different schemas).`;
  }

  revenueScenarioCopy(): string {
    return this.shareableSchema
      ? 'Forecasts expected retail revenue from the shared feature row — pricing, promotion, inventory, and demand context as defined by your revenue joblib. You never supply the historical revenue target.'
      : 'Forecasts expected retail revenue from the revenue model input block only (schema may differ from stock-out). You never supply the historical revenue target.';
  }

  stockScenarioCopy(): string {
    return this.shareableSchema
      ? 'Scores inventory shortage risk from the same retail feature row as revenue. You never supply the stockout_risk training label.'
      : 'Scores shortage risk from the stock-out model input block only. You never supply the stockout_risk training label.';
  }

  private splitMlAndNarrative(data: Record<string, unknown>): {
    ml: Record<string, unknown>;
    narrative: string | null;
    narrativeError: string | null;
  } {
    const ml = { ...data };
    const narrative = ml['narrative'];
    const narrativeError = ml['narrativeError'];
    delete ml['narrative'];
    delete ml['narrativeError'];
    return {
      ml,
      narrative: typeof narrative === 'string' ? narrative : null,
      narrativeError: typeof narrativeError === 'string' ? narrativeError : null,
    };
  }
}
