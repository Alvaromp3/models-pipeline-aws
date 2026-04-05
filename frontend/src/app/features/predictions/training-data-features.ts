/** Columnas alineadas con el dataset limpio (Parquet) usado para entrenar los modelos joblib. */
export type TrainingColumnDoc = {
  name: string;
  type: string;
  description: string;
};

export const TRAINING_COLUMN_DOCS: TrainingColumnDoc[] = [
  { name: 'order_id', type: 'string', description: 'Identificador de pedido / transacción.' },
  { name: 'date', type: 'date / string ISO', description: 'Fecha de la línea de venta o snapshot.' },
  { name: 'store_id', type: 'int / string', description: 'Tienda o punto de venta.' },
  { name: 'region', type: 'string', description: 'Región comercial (p. ej. EMEA, AMER).' },
  { name: 'channel', type: 'string', description: 'Canal (Online, Retail, B2B, …).' },
  { name: 'sku_id', type: 'string', description: 'Código SKU alineado con catálogo.' },
  { name: 'category', type: 'string', description: 'Categoría de producto.' },
  { name: 'brand', type: 'string', description: 'Marca.' },
  { name: 'customer_segment', type: 'string', description: 'Segmento de cliente.' },
  { name: 'base_price', type: 'float', description: 'Precio base o PVP de referencia.' },
  {
    name: '…',
    type: '—',
    description:
      'El Parquet limpio puede incluir más columnas intermedias (p. ej. unidades, coste, flags promocionales) según el pipeline de Spark/ETL.',
  },
  { name: 'returned_units', type: 'float / int', description: 'Unidades devueltas en el periodo.' },
  {
    name: 'revenue',
    type: 'float',
    description: 'Ingresos; en entrenamiento del modelo de revenue suele ser la variable objetivo (no hace falta enviarla si el pipeline solo usa features).',
  },
  {
    name: 'stockout_risk',
    type: 'float / int (0/1)',
    description: 'Etiqueta o proxy de riesgo de rotura usado al entrenar el clasificador de stock-out.',
  },
  { name: 'day_of_week', type: 'int (0–6)', description: 'Día de la semana derivado de date.' },
  { name: 'month', type: 'int (1–12)', description: 'Mes civil.' },
  { name: 'year', type: 'int', description: 'Año.' },
  { name: 'discount_effect', type: 'float', description: 'Efecto o intensidad de descuento aplicado.' },
  { name: 'stock_ratio', type: 'float', description: 'Ratio inventario / demanda o cobertura normalizada.' },
  { name: 'is_weekend', type: 'int (0/1)', description: 'Indicador fin de semana.' },
  { name: 'returns_ratio', type: 'float', description: 'Ratio de devoluciones sobre ventas.' },
];

/**
 * Fila de ejemplo para inferencia: el servicio ML rellena NaN en columnas que el joblib declare
 * en `feature_names_in_` y ignora claves sobrantes según el pipeline.
 */
export function defaultSampleFeatureRow(): Record<string, string | number> {
  return {
    order_id: 'ORD-DEMO-1',
    date: '2024-06-15',
    store_id: 101,
    region: 'EMEA',
    channel: 'Online',
    sku_id: 'SKU-10042',
    category: 'Electronics',
    brand: 'NovaBrand',
    customer_segment: 'B2C',
    base_price: 49.99,
    returned_units: 0,
    revenue: 1280.4,
    stockout_risk: 0,
    day_of_week: 5,
    month: 6,
    year: 2024,
    discount_effect: 0.08,
    stock_ratio: 0.85,
    is_weekend: 0,
    returns_ratio: 0.015,
    stock_days: 5,
  };
}
