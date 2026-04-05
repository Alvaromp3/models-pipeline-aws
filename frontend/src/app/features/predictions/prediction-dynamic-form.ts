import {
  COMBO_FEATURE_KEYS,
  getComboboxSuggestionList,
} from './prediction-domain-suggestions';
import { defaultRetailScenarioForm } from './training-data-features';

/** Targets must never appear in request bodies from this UI. */
const TRAINING_TARGETS = new Set(['revenue', 'stockout_risk']);

const COMBO_SET = new Set<string>(COMBO_FEATURE_KEYS);

export type RetailFieldWidget = 'combobox' | 'numeric' | 'text';

export type ModelFeatureMetadata = {
  revenue_features: string[];
  stockout_features: string[];
};

function dedupePreserveOrder(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/** Normalize API response and strip training targets if misreported. */
export function sanitizeFeatureList(names: unknown): string[] {
  if (!Array.isArray(names)) return [];
  const raw: string[] = [];
  for (const x of names) {
    if (typeof x !== 'string') continue;
    const t = x.trim();
    if (!t || TRAINING_TARGETS.has(t)) continue;
    raw.push(t);
  }
  return dedupePreserveOrder(raw);
}

export function sameFeatureSchema(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const x of b) {
    if (!sa.has(x)) return false;
  }
  return true;
}

export function retailFieldWidget(feature: string): RetailFieldWidget {
  if (COMBO_SET.has(feature)) return 'combobox';
  if (
    /^(base_price|promo_pct|stock_on_hand|units_sold|returned_units|discount_effect|stock_ratio|returns_ratio|stock_days)$/i.test(
      feature,
    ) ||
    /_(ratio|pct|price|effect)$/i.test(feature) ||
    /^units_/i.test(feature)
  ) {
    return 'numeric';
  }
  return 'text';
}

const RETAIL_LABELS: Record<string, string> = {
  order_id: 'Order ID',
  date: 'Date',
  store_id: 'Store ID',
  region: 'Region',
  channel: 'Channel',
  sku_id: 'SKU ID',
  category: 'Category',
  brand: 'Brand',
  customer_segment: 'Customer segment',
  base_price: 'Base price',
  promo_pct: 'Promo percentage',
  stock_on_hand: 'Stock on hand',
  units_sold: 'Units sold',
  returned_units: 'Returned units',
  day_of_week: 'Day of week',
  month: 'Month',
  year: 'Year',
  discount_effect: 'Discount effect',
  stock_ratio: 'Stock ratio',
  is_weekend: 'Is weekend',
  returns_ratio: 'Returns ratio',
  stock_days: 'Stock days',
};

export function retailFeatureLabel(feature: string): string {
  return RETAIL_LABELS[feature] ?? titleCaseFeature(feature);
}

function titleCaseFeature(s: string): string {
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const RETAIL_HINTS: Partial<Record<string, string>> = {
  store_id: 'Dataset uses s001–s060 style keys; samples are frequent stores only.',
  day_of_week: 'Dataset uses weekday names (e.g. Monday). Match training literals.',
  month: 'Use 1–12 as in training, or type a value your pipeline accepts.',
  year: 'Dataset includes 2023 and 2024.',
  is_weekend: 'Dataset booleans: type true or false.',
  sku_id: '6877 distinct SKUs — samples only; type or search any ID.',
  region: 'Exact domain: north, central, south, east, west — type or filter.',
};

export function retailFieldHint(feature: string): string | null {
  return RETAIL_HINTS[feature] ?? null;
}

export function suggestionsForFeature(feature: string): string[] {
  return getComboboxSuggestionList(feature);
}

export function seedValuesForFeatures(features: string[]): Record<string, string> {
  const defaults = defaultRetailScenarioForm() as unknown as Record<string, string>;
  const out: Record<string, string> = {};
  for (const f of features) {
    const v = defaults[f];
    out[f] = v !== undefined && v !== null ? String(v) : '';
  }
  return out;
}

function parseFloatStrict(raw: string): number | undefined {
  const t = raw.trim().replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function parseIntStrict(raw: string): number | undefined {
  const t = raw.trim();
  if (t === '') return undefined;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseStoreId(raw: string): string | number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  return t;
}

/**
 * Single feature cell → JSON value. Empty / invalid → undefined (key omitted from payload).
 */
export function parseValueForFeature(feature: string, raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;

  const w = retailFieldWidget(feature);

  if (feature === 'store_id') {
    return parseStoreId(raw);
  }

  if (feature === 'is_weekend') {
    const tl = trimmed.toLowerCase();
    if (tl === 'true') return true;
    if (tl === 'false') return false;
    const iw = parseIntStrict(raw);
    if (iw === 0) return false;
    if (iw === 1) return true;
    return undefined;
  }

  if (feature === 'month') {
    const n = parseIntStrict(raw);
    if (n !== undefined && n >= 1 && n <= 12) return n;
    const monthNames: Record<string, number> = {
      january: 1,
      february: 2,
      march: 3,
      april: 4,
      may: 5,
      june: 6,
      july: 7,
      august: 8,
      september: 9,
      october: 10,
      november: 11,
      december: 12,
    };
    const m = monthNames[trimmed.toLowerCase()];
    if (m !== undefined) return m;
    return undefined;
  }

  if (feature === 'year') {
    const n = parseIntStrict(raw);
    if (n !== undefined && n >= 1900 && n <= 2100) return n;
    return undefined;
  }

  if (w === 'numeric') {
    const n = parseFloatStrict(raw);
    return n !== undefined ? n : undefined;
  }

  return trimmed;
}

/** Strict body: exactly the given feature keys, in list order, no extras. */
export function buildStrictModelPayload(
  featureOrder: string[],
  values: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of featureOrder) {
    const raw = values[name];
    if (raw === undefined || raw === null) continue;
    const parsed = parseValueForFeature(name, String(raw));
    if (parsed !== undefined) out[name] = parsed;
  }
  return out;
}

export function normalizeMetadataPayload(raw: unknown): ModelFeatureMetadata {
  const o = raw as Record<string, unknown>;
  return {
    revenue_features: sanitizeFeatureList(o['revenue_features']),
    stockout_features: sanitizeFeatureList(o['stockout_features']),
  };
}
