/**
 * Retail prediction form — domain values aligned with the production dataset.
 *
 * Static today. To load from the backend later:
 * 1. Add an endpoint that returns distinct values / histograms per column (same keys as below).
 * 2. Replace or merge into a runtime store; keep this file as fallback or delete after migration.
 *
 * See `RetailDomainApiShape` for a suggested response contract.
 */

export type SuggestionSource = 'static' | 'api';

/** Suggested API payload for dynamic distincts (future). */
export type RetailDomainApiShape = {
  version: number;
  source: 'api';
  /** feature_name → allowed or frequent distinct string values */
  categoricals: Record<string, string[]>;
  /** feature_name → { label, value } quick picks (optional) */
  helperChips?: Record<string, { label: string; value: string }[]>;
  /** feature_name → human range line for the helper panel */
  numericRangeHints?: Record<string, string>;
};

export type HelperChip = { label: string; value: string };

export type FieldHelperPanel = {
  title: string;
  context?: string;
  rangeNote?: string;
  chips: HelperChip[];
  source: SuggestionSource;
};

/**
 * Columns that use the searchable combobox (type + filter + scrollable list).
 * Must stay in sync with `RETAIL_SUGGESTIONS` keys.
 */
export const COMBO_FEATURE_KEYS = [
  'region',
  'channel',
  'sku_id',
  'category',
  'brand',
  'customer_segment',
  'store_id',
  'day_of_week',
  'month',
  'year',
  'is_weekend',
] as const;

export type ComboFeatureKey = (typeof COMBO_FEATURE_KEYS)[number];

export type RetailSuggestionLists = Record<ComboFeatureKey, string[]>;

/** Exact dataset categoricals (lowercase where specified). */
const REGION = ['north', 'central', 'south', 'east', 'west'] as const;

const CHANNEL = ['store', 'online', 'marketplace'] as const;

/** Spec: 7 categories; only these five names were listed — add the other two via API/manifest when known. */
const CATEGORY = ['grocery', 'electronics', 'fashion', 'beauty', 'home'] as const;

/** Spec: 10 brands; only these five were listed — add the other five via API/manifest when known. */
const BRAND = ['orbit', 'peak', 'luma', 'terra', 'hexa'] as const;

const CUSTOMER_SEGMENT = ['consumer', 'small_business', 'enterprise'] as const;

/** Sample SKUs only (6877 distinct in data — not enumerated). */
const SKU_SAMPLES = [
  'SKU-GRO-7349',
  'SKU-GRO-9953',
  'SKU-BEA-7202',
  'SKU-GRO-6037',
  'SKU-ELE-1163',
] as const;

/** Frequent stores only (60 distinct s001–s060 — not enumerated). */
const STORE_SAMPLES = ['s032', 's054', 's023', 's044', 's046'] as const;

const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

const MONTH_NUMS = Array.from({ length: 12 }, (_, i) => String(i + 1));

const YEAR = ['2023', '2024'] as const;

const WEEKEND_TF = ['true', 'false'] as const;

export const RETAIL_SUGGESTIONS: RetailSuggestionLists = {
  region: [...REGION],
  channel: [...CHANNEL],
  sku_id: [...SKU_SAMPLES],
  category: [...CATEGORY],
  brand: [...BRAND],
  customer_segment: [...CUSTOMER_SEGMENT],
  store_id: [...STORE_SAMPLES],
  day_of_week: [...DAY_NAMES],
  month: MONTH_NUMS,
  year: [...YEAR],
  is_weekend: [...WEEKEND_TF],
};

const COMBO_KEY_SET = new Set<string>(COMBO_FEATURE_KEYS);

/** Combobox + helper quick picks share lists for these columns (subset may be samples only). */
export function getComboboxSuggestionList(feature: string): string[] {
  if (COMBO_KEY_SET.has(feature)) {
    return RETAIL_SUGGESTIONS[feature as ComboFeatureKey];
  }
  return [];
}

const MONTH_CHIPS: HelperChip[] = [
  { label: 'January — 1', value: '1' },
  { label: 'February — 2', value: '2' },
  { label: 'March — 3', value: '3' },
  { label: 'April — 4', value: '4' },
  { label: 'May — 5', value: '5' },
  { label: 'June — 6', value: '6' },
  { label: 'July — 7', value: '7' },
  { label: 'August — 8', value: '8' },
  { label: 'September — 9', value: '9' },
  { label: 'October — 10', value: '10' },
  { label: 'November — 11', value: '11' },
  { label: 'December — 12', value: '12' },
];

const DOW_CHIPS: HelperChip[] = DAY_NAMES.map((d) => ({ label: d, value: d }));

function chipsFromStrings(values: readonly string[]): HelperChip[] {
  return values.map((v) => ({ label: v, value: v }));
}

/**
 * Sidebar helper content. Targets are omitted from forms upstream.
 */
export function buildHelperPanel(feature: string): FieldHelperPanel | null {
  if (feature === 'revenue' || feature === 'stockout_risk') return null;

  switch (feature) {
    case 'region':
      return {
        title: 'Region',
        context: 'Dataset categoricals (5 levels). Type any value; list is the exact domain.',
        chips: chipsFromStrings(REGION),
        source: 'static',
      };
    case 'channel':
      return {
        title: 'Channel',
        context: 'Dataset categoricals: store, online, marketplace.',
        chips: chipsFromStrings(CHANNEL),
        source: 'static',
      };
    case 'sku_id':
      return {
        title: 'SKU ID',
        context:
          '6 877 distinct SKUs in the dataset — only sample IDs are listed. Type or search any SKU.',
        chips: chipsFromStrings(SKU_SAMPLES),
        source: 'static',
      };
    case 'category':
      return {
        title: 'Category',
        context:
          'Five category names supplied for the extract; spec mentions seven total — extend via API when the remaining two names are confirmed.',
        chips: chipsFromStrings(CATEGORY),
        source: 'static',
      };
    case 'brand':
      return {
        title: 'Brand',
        context:
          'Five brand names supplied; spec mentions ten total — extend via API when the remaining five are confirmed.',
        chips: chipsFromStrings(BRAND),
        source: 'static',
      };
    case 'customer_segment':
      return {
        title: 'Customer segment',
        context: 'Dataset categoricals: consumer, small_business, enterprise.',
        chips: chipsFromStrings(CUSTOMER_SEGMENT),
        source: 'static',
      };
    case 'order_id':
      return {
        title: 'Order ID',
        context: 'If present in your model features, use the literal format from the sales extract.',
        chips: [],
        source: 'static',
      };
    case 'date':
      return {
        title: 'Date',
        context: 'Use the same date encoding as training (e.g. ISO YYYY-MM-DD).',
        chips: [],
        source: 'static',
      };
    case 'store_id':
      return {
        title: 'Store ID',
        context:
          '60 stores (s001–s060 style in the dataset). Only high-frequency samples are listed — type any valid store key.',
        chips: chipsFromStrings(STORE_SAMPLES),
        source: 'static',
      };
    case 'day_of_week':
      return {
        title: 'Day of week',
        context: 'Dataset categoricals: weekday names. Must match training literals exactly.',
        chips: DOW_CHIPS,
        source: 'static',
      };
    case 'month':
      return {
        title: 'Month',
        context: 'Numeric month 1–12 as in training, or pick a named month below.',
        chips: MONTH_CHIPS,
        source: 'static',
      };
    case 'year':
      return {
        title: 'Year',
        context: 'Years present in the retail panel.',
        rangeNote: 'Dataset includes 2023 and 2024.',
        chips: chipsFromStrings(YEAR),
        source: 'static',
      };
    case 'is_weekend':
      return {
        title: 'Is weekend',
        context: 'Dataset booleans: true or false (not 0/1).',
        chips: [
          { label: 'true', value: 'true' },
          { label: 'false', value: 'false' },
        ],
        source: 'static',
      };
    case 'base_price':
      return {
        title: 'Base price',
        context: 'Regular price before promotion.',
        rangeNote: 'Typical range in data: about 5 – 500 (same currency as training).',
        chips: [
          { label: '9.99', value: '9.99' },
          { label: '24.99', value: '24.99' },
          { label: '49.99', value: '49.99' },
          { label: '129.00', value: '129.00' },
          { label: '299.00', value: '299.00' },
        ],
        source: 'static',
      };
    case 'promo_pct':
      return {
        title: 'Promo %',
        context: 'Promotional depth as engineered in the dataset.',
        rangeNote: 'Typical range: 0 – 0.5.',
        chips: [
          { label: '0', value: '0' },
          { label: '0.1', value: '0.1' },
          { label: '0.25', value: '0.25' },
          { label: '0.4', value: '0.4' },
          { label: '0.5', value: '0.5' },
        ],
        source: 'static',
      };
    case 'stock_on_hand':
      return {
        title: 'Stock on hand',
        context: 'On-hand units for the SKU context.',
        rangeNote: 'Typical range: 0 – 1000+.',
        chips: [
          { label: '0', value: '0' },
          { label: '120', value: '120' },
          { label: '420', value: '420' },
          { label: '800', value: '800' },
        ],
        source: 'static',
      };
    case 'units_sold':
      return {
        title: 'Units sold',
        context: 'Units in the reference window used as a feature.',
        rangeNote: 'Typical range: 0 – 200.',
        chips: [
          { label: '0', value: '0' },
          { label: '24', value: '24' },
          { label: '64', value: '64' },
          { label: '128', value: '128' },
          { label: '180', value: '180' },
        ],
        source: 'static',
      };
    case 'returned_units':
      return {
        title: 'Returned units',
        context: 'Returns in the same period as sales features.',
        rangeNote: 'Typical range: 0 – 50.',
        chips: [
          { label: '0', value: '0' },
          { label: '2', value: '2' },
          { label: '8', value: '8' },
          { label: '24', value: '24' },
        ],
        source: 'static',
      };
    case 'discount_effect':
      return {
        title: 'Discount effect',
        context: 'Engineered discount signal.',
        rangeNote: 'Typical range: −1 to 1.',
        chips: [
          { label: '-0.5', value: '-0.5' },
          { label: '0', value: '0' },
          { label: '0.25', value: '0.25' },
          { label: '0.75', value: '0.75' },
          { label: '1', value: '1' },
        ],
        source: 'static',
      };
    case 'stock_ratio':
      return {
        title: 'Stock ratio',
        context: 'Normalized inventory / coverage signal.',
        rangeNote: 'Typical range: 0 – 1.',
        chips: [
          { label: '0.15', value: '0.15' },
          { label: '0.35', value: '0.35' },
          { label: '0.65', value: '0.65' },
          { label: '0.9', value: '0.9' },
        ],
        source: 'static',
      };
    case 'returns_ratio':
      return {
        title: 'Returns ratio',
        context: 'Returns relative to sales in the window.',
        rangeNote: 'Typical range: 0 – 1.',
        chips: [
          { label: '0', value: '0' },
          { label: '0.01', value: '0.01' },
          { label: '0.03', value: '0.03' },
          { label: '0.06', value: '0.06' },
        ],
        source: 'static',
      };
    default:
      if (
        /^(base_price|promo_pct|stock_on_hand|units_sold|returned_units|day_of_week|month|year|discount_effect|stock_ratio|returns_ratio|stock_days)$/i.test(
          feature,
        ) ||
        /_(ratio|pct|price|effect)$/i.test(feature) ||
        /^units_/i.test(feature)
      ) {
        return {
          title: titleCase(feature),
          context: 'Numeric feature — match the scale used in training.',
          rangeNote: 'Pick an example or type any valid number.',
          chips: [
            { label: '0', value: '0' },
            { label: '1', value: '1' },
            { label: '10', value: '10' },
            { label: '100', value: '100' },
          ],
          source: 'static',
        };
      }
      return {
        title: titleCase(feature),
        context: 'Match literals from your cleaned extract.',
        chips: [],
        source: 'static',
      };
  }
}

function titleCase(feature: string): string {
  return feature.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
