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
    model: 'Ingresos',
    meaning:
      'Estimación numérica del modelo de regresión (unidades monetarias o escala acordada con el entrenamiento). Sustituye al target `revenue` en tiempo de inferencia: es la “respuesta” del modelo ante la fila de features enviada.',
    businessUse:
      'Comparar con objetivo de ventas o con escenarios base/alternativos; si el pipeline está en escala log o normalizada, documentar internamente el factor de reversión antes de usarlo en reporting ejecutivo.',
  },
  {
    field: 'risk_score',
    model: 'Stock-out',
    meaning:
      'Puntuación de riesgo entre 0 y 1 cuando el estimador expone probabilidad de clase positiva (`predict_proba`); en modelos sin probabilidades puede ser la clase o un score bruto acotado por el servicio.',
    businessUse:
      'Umbralizar alertas (p. ej. >0,7) para priorizar SKUs en tableros de operaciones; conviene calibrar el punto de corte con negocio según coste de falso alarma vs coste de rotura real.',
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
