"""
Servicio ML (FastAPI) — predicciones stub que consume el backend Nest.

Variables opcionales (ver `ml-service/.env.example`): artefactos `.joblib` desde
disco y/o S3 (`ML_MODEL_ORDER`, `ML_SKIP_LOCAL`, reintentos en `get_object`).
`/health` incluye `head_object` por key y estado de carga. Sin modelo válido → stub.
"""

from __future__ import annotations

import os

# Python 3.13 + importlib.metadata: sin esto Pydantic puede fallar al cargar plugins (OSError 89).
os.environ.setdefault("PYDANTIC_DISABLE_PLUGINS", "1")
# Evita que botocore intente IMDS en portátil (puede colgar minutos sin EC2).
os.environ.setdefault("AWS_EC2_METADATA_DISABLED", "true")

import logging
from concurrent.futures import ThreadPoolExecutor, wait
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel

from app.model_store import (
    get_revenue_model,
    get_stockout_model,
    list_feature_names,
    models_status,
    predict_regression_with_confidence,
    predict_risk_score,
)

from app.s3_config import (
    can_reach_s3_bucket,
    enrich_snapshot_with_model_heads,
    s3_env_snapshot,
)

logger = logging.getLogger(__name__)

app = FastAPI(title="NovaRetail ML", version="0.1.0")


@app.get("/live")
def live() -> dict[str, str]:
    """Liveness rápida (sin S3). Usar en make/scripts; `/health` sigue siendo el chequeo completo."""
    return {"status": "ok"}


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "novaretail-ml"
    s3: dict[str, Any]
    s3BucketReachable: bool | None = None
    models: dict[str, Any]


class ModelFeaturesResponse(BaseModel):
    revenue_features: list[str]
    stockout_features: list[str]


@app.get("/metadata/features", response_model=ModelFeaturesResponse)
def metadata_features() -> ModelFeaturesResponse:
    """Expected input columns from loaded joblib models (`feature_names_in_`), empty if stub/unavailable."""
    rev, _ = get_revenue_model()
    st, _ = get_stockout_model()
    return ModelFeaturesResponse(
        revenue_features=list_feature_names(rev),
        stockout_features=list_feature_names(st),
    )


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    base = s3_env_snapshot()
    degraded = {
        **base,
        "revenueObjectHeadOk": None,
        "stockoutObjectHeadOk": None,
        "s3ProbeTimedOut": True,
    }
    with ThreadPoolExecutor(max_workers=2) as pool:
        f_snap = pool.submit(enrich_snapshot_with_model_heads, base)
        f_reach = pool.submit(can_reach_s3_bucket)
        done, _pending = wait([f_snap, f_reach], timeout=12)
        snap: dict[str, Any] = degraded
        reachable: bool | None = None
        if f_snap in done:
            try:
                snap = f_snap.result()
            except Exception as e:  # noqa: BLE001
                logger.warning("enrich_snapshot_with_model_heads: %s", e)
                snap = degraded
        if f_reach in done:
            try:
                reachable = f_reach.result()
            except Exception as e:  # noqa: BLE001
                logger.warning("can_reach_s3_bucket: %s", e)
                reachable = None
    return HealthResponse(
        s3=snap,
        s3BucketReachable=reachable,
        models=models_status(),
    )


@app.post("/predict/revenue")
def predict_revenue(body: dict) -> dict:
    region = body.get("region") or "default"
    model, load_err = get_revenue_model()
    predict_err: str | None = None
    if model is not None:
        try:
            value, confidence = predict_regression_with_confidence(model, body)
            src = models_status().get("revenueLoadSource")
            name = f"joblib_revenue_{src}" if src else "joblib_revenue"
            return {
                "model": name,
                "region": region,
                "predicted_revenue_units": round(float(value), 4),
                "confidence": confidence,
            }
        except Exception as e:  # noqa: BLE001
            logger.warning("predict/revenue: modelo S3 no aplicó al payload: %s", e)
            predict_err = str(e)
    base = hash(str(body)) % 1000 / 100.0
    out: dict[str, Any] = {
        "model": "revenue_stub_v1",
        "region": region,
        "predicted_revenue_units": round(120.0 + base, 2),
        "confidence": 0.82,
    }
    if load_err:
        out["loadWarning"] = load_err
    if predict_err:
        out["predictError"] = predict_err
    return out


@app.post("/predict/stockout-risk")
def predict_stockout(body: dict) -> dict:
    sku = body.get("sku") or body.get("sku_id") or "unknown"
    model, load_err = get_stockout_model()
    predict_err: str | None = None
    if model is not None:
        try:
            score, alert = predict_risk_score(model, body)
            src = models_status().get("stockoutLoadSource")
            name = f"joblib_stockout_{src}" if src else "joblib_stockout"
            return {
                "model": name,
                "sku": sku,
                "risk_score": round(score, 4),
                "alert": alert,
            }
        except Exception as e:  # noqa: BLE001
            logger.warning("predict/stockout-risk: modelo S3 no aplicó al payload: %s", e)
            predict_err = str(e)
    risk = min(0.99, (hash(str(sku)) % 100) / 100.0)
    out: dict[str, Any] = {
        "model": "stockout_stub_v1",
        "sku": sku,
        "risk_score": round(risk, 3),
        "alert": risk > 0.7,
    }
    if load_err:
        out["loadWarning"] = load_err
    if predict_err:
        out["predictError"] = predict_err
    return out
