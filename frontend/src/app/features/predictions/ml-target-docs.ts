/**
 * Qué significa cada target en el dataset y por qué importa para decisiones de negocio.
 * Las salidas del API explican cómo interpretar lo que devuelve cada modelo en producción.
 */

export type MlTargetDoc = {
  column: string;
  model: string;
  definition: string;
  businessValue: string;
  decisions: string;
};

export const ML_TARGET_DOCS: MlTargetDoc[] = [
  {
    column: 'revenue',
    model: 'Modelo de ingresos (regresión)',
    definition:
      'Variable objetivo histórica: ingreso monetario asociado a la línea de pedido o agregación usada en el entrenamiento (misma moneda y granularidad que en el Parquet limpio). El modelo aprende a estimar este valor a partir del resto de señales operativas y comerciales.',
    businessValue:
      'Acerca la planificación financiera y comercial a la demanda real esperada: anticipa caja, márgenes y cumplimiento de objetivos por región, canal o SKU sin depender solo de medias históricas rígidas.',
    decisions:
      'Presupuestos y forecast de ventas · asignación de stock y promociones · priorización de categorías o tiendas · revisiones de precio o descuento cuando el escenario predicho se desvía del plan.',
  },
  {
    column: 'stockout_risk',
    model: 'Modelo de riesgo de rotura de stock (clasificación)',
    definition:
      'Etiqueta o proxy de riesgo de quiebre (p. ej. binaria 0/1 o probabilidad derivada de reglas históricas). Indica si, en condiciones similares en el pasado, el SKU o la tienda tendían a quedarse sin inventario suficiente frente a la demanda.',
    businessValue:
      'Reduce ventas perdidas y deterioro de servicio al cliente: pone un número explícito al riesgo operativo antes de que ocurra el rupture, alineando compras, logística y comercio.',
    decisions:
      'Reposición urgente o traspaso entre tiendas · ajuste de MOQ o lead time con proveedor · sustitución de SKU o comunicación al canal · escenarios de promoción solo si el riesgo y el margen lo justifican.',
  },
];

export type MlOutputDoc = {
  field: string;
  model: string;
  meaning: string;
  businessUse: string;
};

/** Cómo leer las claves que devuelve el servicio ML tras una inferencia. */
export const ML_OUTPUT_DOCS: MlOutputDoc[] = [
  {
    field: 'predicted_revenue_units',
    model: 'Revenue (retail regression)',
    meaning:
      'Point forecast of retail revenue (or the scale used in training) for the feature row you sent. At inference it replaces the historical `revenue` target: it is the model’s answer given store, SKU, price, promo, inventory, and related retail signals.',
    businessUse:
      'Compare to sales plans, prior weeks, or alternate scenarios; if training used log or normalized targets, document the back-transform before executive reporting.',
  },
  {
    field: 'risk_score',
    model: 'Stock-out (retail classification)',
    meaning:
      'Score in [0, 1] when the classifier exposes `predict_proba` for the positive (high-risk) class; otherwise a raw class or bounded score from the estimator.',
    businessUse:
      'Threshold alerts (e.g. above 0.7) to prioritize replenishment, transfers, or vendor escalations; tune the cutoff with ops using cost of false alarm vs lost sales from stock-outs.',
  },
  {
    field: 'alert',
    model: 'Stock-out',
    meaning:
      'Indicador booleano derivado del `risk_score` frente a un umbral fijo en el servicio ML: indica si el caso requiere atención inmediata según la política técnica actual.',
    businessUse:
      'Automatizar listas de trabajo para compras o tienda; revisar periódicamente el umbral para que siga alineado con la tolerancia al riesgo de la dirección de operaciones.',
  },
  {
    field: 'model',
    model: 'Ambos',
    meaning:
      'Identificador del artefacto o modo usado (`joblib_revenue_s3`, stub, etc.). Permite auditoría y trazabilidad de qué versión respondió cada petición.',
    businessUse:
      'Gobernanza y confianza en el dato: en informes para dirección, filtrar solo predicciones con modelo productivo (no stub) cuando se tomen decisiones materiales.',
  },
];
