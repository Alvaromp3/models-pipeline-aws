"""Estado de variables S3 (modelos ML) y comprobación de objetos del bucket."""

from __future__ import annotations

import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

logger = logging.getLogger(__name__)

# Evita que /health bloquee minutos si la red o S3 no responden (curl en wait-for-http usa --max-time 5).
def _s3_client_fast():
    try:
        import boto3  # type: ignore[import-not-found]
        from botocore.config import Config  # type: ignore[import-not-found]
    except ImportError:
        return None
    cfg = Config(
        connect_timeout=3,
        read_timeout=5,
        retries={"max_attempts": 1, "mode": "standard"},
    )
    return boto3.client(
        "s3",
        region_name=os.getenv("AWS_REGION") or None,
        config=cfg,
    )


def s3_env_snapshot() -> dict[str, Any]:
    bucket = (os.getenv("S3_MODEL_BUCKET") or "").strip()
    revenue = (os.getenv("S3_REVENUE_MODEL_KEY") or "").strip()
    stockout = (os.getenv("S3_STOCKOUT_MODEL_KEY") or "").strip()
    region = (os.getenv("AWS_REGION") or "").strip()
    return {
        "bucketConfigured": bool(bucket),
        "revenueKeyConfigured": bool(revenue),
        "stockoutKeyConfigured": bool(stockout),
        "regionConfigured": bool(region),
        "revenueUsesStub": not (bucket and revenue),
        "stockoutUsesStub": not (bucket and stockout),
    }


def enrich_snapshot_with_model_heads(base: dict[str, Any]) -> dict[str, Any]:
    """
    `head_object` sobre las keys de los joblib: valida que existan antes de `get_object`.
    None = no aplicable (sin bucket/key o sin boto3).
    """
    client = _s3_client_fast()
    if client is None:
        return {
            **base,
            "revenueObjectHeadOk": None,
            "stockoutObjectHeadOk": None,
        }

    from botocore.exceptions import BotoCoreError, ClientError  # type: ignore[import-not-found]

    bucket = (os.getenv("S3_MODEL_BUCKET") or "").strip()
    revenue = (os.getenv("S3_REVENUE_MODEL_KEY") or "").strip()
    stockout = (os.getenv("S3_STOCKOUT_MODEL_KEY") or "").strip()
    if not bucket:
        return {
            **base,
            "revenueObjectHeadOk": None,
            "stockoutObjectHeadOk": None,
        }

    def head_key(key: str) -> bool | None:
        if not key:
            return None
        try:
            client.head_object(Bucket=bucket, Key=key)
            return True
        except ClientError as e:
            code = (e.response.get("Error") or {}).get("Code", "")
            if code in ("404", "NoSuchKey", "NotFound", "404 Not Found"):
                return False
            logger.warning("head_object s3://%s/%s: %s", bucket, key, e)
            return False
        except (BotoCoreError, OSError) as e:
            logger.warning("head_object s3://%s/%s: %s", bucket, key, e)
            return False

    rev_ok: bool | None = None
    sto_ok: bool | None = None
    tasks: list[tuple[str, str]] = []
    if revenue:
        tasks.append(("revenue", revenue))
    if stockout:
        tasks.append(("stockout", stockout))
    if tasks:
        with ThreadPoolExecutor(max_workers=len(tasks)) as pool:
            fmap = {pool.submit(head_key, k): name for name, k in tasks}
            for fut in as_completed(fmap):
                name = fmap[fut]
                val = fut.result()
                if name == "revenue":
                    rev_ok = val
                else:
                    sto_ok = val

    return {
        **base,
        "revenueObjectHeadOk": rev_ok if revenue else None,
        "stockoutObjectHeadOk": sto_ok if stockout else None,
    }


def can_reach_s3_bucket() -> bool | None:
    """
    None = no comprobar (falta boto3 o bucket).
    True/False = resultado de head_bucket (credenciales / permisos).
    """
    client = _s3_client_fast()
    if client is None:
        return None

    from botocore.exceptions import BotoCoreError, ClientError  # type: ignore[import-not-found]

    bucket = (os.getenv("S3_MODEL_BUCKET") or "").strip()
    if not bucket:
        return None

    try:
        client.head_bucket(Bucket=bucket)
        return True
    except (ClientError, BotoCoreError, OSError):
        return False
