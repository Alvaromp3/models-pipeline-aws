"""
Carga perezosa de artefactos `.joblib` desde disco y/o S3.

- `ML_MODEL_ORDER=local_first` (defecto) o `s3_first` (prioriza bucket en prod).
- `ML_SKIP_LOCAL=1`: solo S3 o stub (validar integración S3 sin ficheros locales).
- S3: hasta 3 intentos con backoff ante errores transitorios.
"""

from __future__ import annotations

import io
import logging
import os
import threading
import time
from collections.abc import Callable
from typing import Any

logger = logging.getLogger(__name__)

_lock = threading.Lock()

_revenue_model: Any | None = None
_revenue_failed: bool = False
_revenue_source: str | None = None

_stockout_model: Any | None = None
_stockout_failed: bool = False
_stockout_source: str | None = None


def _bucket() -> str:
    return (os.getenv("S3_MODEL_BUCKET") or "").strip()


def _revenue_key() -> str:
    return (os.getenv("S3_REVENUE_MODEL_KEY") or "").strip()


def _stockout_key() -> str:
    return (os.getenv("S3_STOCKOUT_MODEL_KEY") or "").strip()


def _path_exists(path: str) -> bool:
    return bool(path and os.path.isfile(path))


def _model_order() -> str:
    v = (os.getenv("ML_MODEL_ORDER") or "local_first").strip().lower()
    return "s3_first" if v == "s3_first" else "local_first"


def _skip_local() -> bool:
    return (os.getenv("ML_SKIP_LOCAL") or "").strip().lower() in ("1", "true", "yes", "on")


def _resolve_local_revenue_path() -> str:
    direct = (os.getenv("LOCAL_REVENUE_MODEL_FILE") or "").strip()
    if direct:
        return os.path.expanduser(direct)
    root = (os.getenv("LOCAL_MODEL_DIR") or "").strip()
    if not root:
        return ""
    root = os.path.expanduser(root)
    override = (os.getenv("LOCAL_REVENUE_MODEL_BASENAME") or "").strip()
    if override:
        return os.path.join(root, override)
    rk = _revenue_key()
    if rk:
        return os.path.join(root, os.path.basename(rk))
    return os.path.join(root, "revenue_model.joblib")


def _resolve_local_stockout_path() -> str:
    direct = (os.getenv("LOCAL_STOCKOUT_MODEL_FILE") or "").strip()
    if direct:
        return os.path.expanduser(direct)
    root = (os.getenv("LOCAL_MODEL_DIR") or "").strip()
    if not root:
        return ""
    root = os.path.expanduser(root)
    override = (os.getenv("LOCAL_STOCKOUT_MODEL_BASENAME") or "").strip()
    if override:
        return os.path.join(root, override)
    sk = _stockout_key()
    if sk:
        return os.path.join(root, os.path.basename(sk))
    return os.path.join(root, "stockout_risk_model.joblib")


def _s3_client():
    import boto3  # type: ignore[import-not-found]

    return boto3.client("s3", region_name=os.getenv("AWS_REGION") or None)


def _load_joblib_from_s3(bucket: str, key: str) -> Any:
    import joblib

    client = _s3_client()
    last_err: Exception | None = None
    for attempt in range(3):
        try:
            obj = client.get_object(Bucket=bucket, Key=key)
            raw = obj["Body"].read()
            return joblib.load(io.BytesIO(raw))
        except Exception as e:  # noqa: BLE001
            last_err = e
            if attempt < 2:
                delay = 0.35 * (2**attempt)
                logger.warning(
                    "S3 get_object intento %s/%s falló (reintento en %.1fs): %s",
                    attempt + 1,
                    3,
                    delay,
                    e,
                )
                time.sleep(delay)
    assert last_err is not None
    raise last_err


def _load_joblib_from_disk(path: str) -> Any:
    import joblib

    return joblib.load(path)


def get_revenue_model() -> tuple[Any | None, str | None]:
    """(modelo, error). None modelo ⇒ usar stub."""
    global _revenue_model, _revenue_failed, _revenue_source
    if _revenue_model is not None:
        return _revenue_model, None
    if _revenue_failed:
        return None, "carga previa fallida (revisa logs, credenciales S3 y rutas locales)"

    b, k = _bucket(), _revenue_key()
    local_path = _resolve_local_revenue_path()
    s3_ok = bool(b and k)
    local_ok = _path_exists(local_path) and not _skip_local()

    with _lock:
        if _revenue_model is not None:
            return _revenue_model, None
        if _revenue_failed:
            return None, "carga previa fallida"

        order = _model_order()
        sources: list[tuple[str, str, Callable[[], Any]]] = []
        if order == "s3_first":
            if s3_ok:
                sources.append(("s3", f"s3://{b}/{k}", lambda: _load_joblib_from_s3(b, k)))
            if local_ok:
                sources.append(("local", local_path, lambda: _load_joblib_from_disk(local_path)))
        else:
            if local_ok:
                sources.append(("local", local_path, lambda: _load_joblib_from_disk(local_path)))
            if s3_ok:
                sources.append(("s3", f"s3://{b}/{k}", lambda: _load_joblib_from_s3(b, k)))

        last_err: str | None = None
        for kind, label, loader in sources:
            try:
                _revenue_model = loader()
                _revenue_source = kind
                logger.info("Modelo revenue cargado desde %s (%s)", kind, label)
                return _revenue_model, None
            except Exception as e:  # noqa: BLE001
                last_err = str(e)
                logger.warning("Fallo carga revenue (%s): %s", label, e)

        if s3_ok or local_ok:
            _revenue_failed = True
            return None, last_err or "no se pudo cargar el modelo revenue"
        return None, None


def get_stockout_model() -> tuple[Any | None, str | None]:
    global _stockout_model, _stockout_failed, _stockout_source
    if _stockout_model is not None:
        return _stockout_model, None
    if _stockout_failed:
        return None, "carga previa fallida (revisa logs, credenciales S3 y rutas locales)"

    b, k = _bucket(), _stockout_key()
    local_path = _resolve_local_stockout_path()
    s3_ok = bool(b and k)
    local_ok = _path_exists(local_path) and not _skip_local()

    with _lock:
        if _stockout_model is not None:
            return _stockout_model, None
        if _stockout_failed:
            return None, "carga previa fallida"

        order = _model_order()
        sources: list[tuple[str, str, Callable[[], Any]]] = []
        if order == "s3_first":
            if s3_ok:
                sources.append(("s3", f"s3://{b}/{k}", lambda: _load_joblib_from_s3(b, k)))
            if local_ok:
                sources.append(("local", local_path, lambda: _load_joblib_from_disk(local_path)))
        else:
            if local_ok:
                sources.append(("local", local_path, lambda: _load_joblib_from_disk(local_path)))
            if s3_ok:
                sources.append(("s3", f"s3://{b}/{k}", lambda: _load_joblib_from_s3(b, k)))

        last_err: str | None = None
        for kind, label, loader in sources:
            try:
                _stockout_model = loader()
                _stockout_source = kind
                logger.info("Modelo stockout cargado desde %s (%s)", kind, label)
                return _stockout_model, None
            except Exception as e:  # noqa: BLE001
                last_err = str(e)
                logger.warning("Fallo carga stockout (%s): %s", label, e)

        if s3_ok or local_ok:
            _stockout_failed = True
            return None, last_err or "no se pudo cargar el modelo stockout"
        return None, None


def _frame_from_body(model: Any, body: dict[str, Any]):
    import numpy as np
    import pandas as pd

    if hasattr(model, "feature_names_in_"):
        names = list(getattr(model, "feature_names_in_"))
        row = {n: body.get(n, np.nan) for n in names}
        return pd.DataFrame([row])
    return pd.DataFrame([body])


def predict_regression(model: Any, body: dict[str, Any]) -> float:
    import numpy as np

    X = _frame_from_body(model, body)
    y = model.predict(X)
    arr = np.asarray(y).ravel()
    return float(arr[0])


def predict_risk_score(model: Any, body: dict[str, Any]) -> tuple[float, bool]:
    """
    Devuelve (score 0..1, alert). Clasificación: `predict_proba` clase positiva si existe.
    """
    import numpy as np

    X = _frame_from_body(model, body)
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(X)
        p = np.asarray(proba)
        if p.ndim == 2 and p.shape[1] >= 2:
            score = float(p[0, 1])
        else:
            score = float(np.max(p))
        alert = score > 0.7
        return score, alert
    y = model.predict(X)
    arr = np.asarray(y).ravel()
    score = float(arr[0])
    if score > 1.0 or score < 0.0:
        score = min(0.99, max(0.0, score))
    alert = score > 0.7
    return score, alert


def models_status() -> dict[str, Any]:
    b, rk, sk = _bucket(), _revenue_key(), _stockout_key()
    rev_local = _resolve_local_revenue_path()
    st_local = _resolve_local_stockout_path()
    skip = _skip_local()
    return {
        "modelOrder": _model_order(),
        "skipLocal": skip,
        "revenueConfigured": bool(b and rk) or (_path_exists(rev_local) and not skip),
        "stockoutConfigured": bool(b and sk) or (_path_exists(st_local) and not skip),
        "revenueLoaded": _revenue_model is not None,
        "stockoutLoaded": _stockout_model is not None,
        "revenueLoadFailed": _revenue_failed,
        "stockoutLoadFailed": _stockout_failed,
        "revenueLoadSource": _revenue_source,
        "stockoutLoadSource": _stockout_source,
        "revenueLocalPath": rev_local or None,
        "revenueLocalFileExists": _path_exists(rev_local),
        "stockoutLocalPath": st_local or None,
        "stockoutLocalFileExists": _path_exists(st_local),
        "s3Bucket": b or None,
        "s3RevenueKey": rk or None,
        "s3StockoutKey": sk or None,
    }
