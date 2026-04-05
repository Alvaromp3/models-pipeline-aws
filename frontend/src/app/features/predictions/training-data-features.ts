/** Columnas del dataset retail limpio alineadas con el esquema de entrenamiento. */
export type TrainingColumnDoc = {
  name: string;
  type: string;
  description: string;
};

export const TRAINING_COLUMN_DOCS: TrainingColumnDoc[] = [
  { name: 'order_id', type: 'string', description: 'Identificador de pedido o línea de venta (solo si el pipeline lo usa como feature).' },
  { name: 'date', type: 'date / ISO string', description: 'Fecha de la transacción o snapshot (solo si el modelo fue entrenado con esta columna).' },
  { name: 'store_id', type: 'int / string', description: 'Tienda o punto de venta.' },
  { name: 'region', type: 'string', description: 'Región comercial o agrupación geográfica de ventas.' },
  { name: 'channel', type: 'string', description: 'Canal de venta (tienda física, e-commerce, marketplace, etc.).' },
  { name: 'sku_id', type: 'string', description: 'Identificador de producto en catálogo.' },
  { name: 'category', type: 'string', description: 'Categoría de producto.' },
  { name: 'brand', type: 'string', description: 'Marca.' },
  { name: 'customer_segment', type: 'string', description: 'Segmento de cliente.' },
  { name: 'base_price', type: 'float', description: 'Precio base o PVP de referencia antes de promociones.' },
  { name: 'promo_pct', type: 'float', description: 'Porcentaje de descuento o promoción aplicable al escenario.' },
  { name: 'stock_on_hand', type: 'float / int', description: 'Unidades disponibles en inventario en el momento del escenario.' },
  { name: 'units_sold', type: 'float / int', description: 'Unidades vendidas en el periodo de referencia (feature contextual).' },
  { name: 'returned_units', type: 'float / int', description: 'Unidades devueltas en el periodo.' },
  { name: 'revenue', type: 'float', description: 'Ingresos (variable objetivo del modelo de regresión — no se envía en el formulario de predicción de revenue).' },
  { name: 'stockout_risk', type: 'float / int (0/1)', description: 'Etiqueta o proxy de riesgo de quiebre (objetivo del clasificador — no se envía en el formulario de stock-out).' },
  { name: 'day_of_week', type: 'int (0–6)', description: 'Día de la semana según la convención usada en el entrenamiento.' },
  { name: 'month', type: 'int (1–12)', description: 'Mes civil.' },
  { name: 'year', type: 'int', description: 'Año civil.' },
  { name: 'discount_effect', type: 'float', description: 'Medida derivada del impacto del descuento sobre demanda o margen.' },
  { name: 'stock_ratio', type: 'float', description: 'Ratio inventario frente a demanda o cobertura normalizada.' },
  { name: 'is_weekend', type: 'int (0/1)', description: 'Indicador de fin de semana.' },
  { name: 'returns_ratio', type: 'float', description: 'Ratio de devoluciones sobre ventas.' },
];

export type { RetailSuggestionLists } from './prediction-domain-suggestions';
export { RETAIL_SUGGESTIONS } from './prediction-domain-suggestions';

/** Estado editable del escenario retail (todo string; se parsea al construir el payload). */
export type RetailScenarioForm = {
  order_id: string;
  date: string;
  store_id: string;
  region: string;
  channel: string;
  sku_id: string;
  category: string;
  brand: string;
  customer_segment: string;
  base_price: string;
  promo_pct: string;
  stock_on_hand: string;
  units_sold: string;
  returned_units: string;
  day_of_week: string;
  month: string;
  year: string;
  discount_effect: string;
  stock_ratio: string;
  is_weekend: string;
  returns_ratio: string;
};

export function defaultRetailScenarioForm(): RetailScenarioForm {
  return {
    order_id: '',
    date: '',
    store_id: 's032',
    region: 'north',
    channel: 'store',
    sku_id: 'SKU-GRO-7349',
    category: 'grocery',
    brand: 'orbit',
    customer_segment: 'consumer',
    base_price: '24.99',
    promo_pct: '0.1',
    stock_on_hand: '420',
    units_sold: '128',
    returned_units: '3',
    day_of_week: 'Monday',
    month: '4',
    year: '2024',
    discount_effect: '0.08',
    stock_ratio: '0.85',
    is_weekend: 'false',
    returns_ratio: '0.018',
  };
}

