#!/usr/bin/env python3
"""Publish a source-backed LetsCart observability ledger."""
from __future__ import annotations
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
now = datetime.now(timezone.utc)
items = json.loads((ROOT / "data.json").read_text(encoding="utf-8"))
catalog = json.loads((ROOT / "data/catalog.json").read_text(encoding="utf-8"))
if not isinstance(items, list) or not items:
    raise RuntimeError("LetsCart data.json has no tracked items")
ids = [item.get("id") for item in items]
duplicate_ids = len(ids) - len({item for item in ids if item})
today = now.astimezone().date().isoformat()
increment = sum(1 for item in items if item.get("liveDate") == today)
stats = catalog.get("stats") or {}
payload = {
    "schema": "lets_observability_v1", "run_id": f"cart-{now.strftime('%Y%m%dT%H%M%SZ')}",
    "observed_at": now.isoformat(), "service_id": "cart", "source": "persisted_letscart_catalog",
    "stages": {
        "collect": {"status": "success", "ok": len(items), "artifact": True},
        "analyze": {"status": "success", "ok": int(stats.get("products", 0) or 0), "artifact": True},
        "quality": {"status": "success" if duplicate_ids == 0 else "degraded", "quality_issue_count": duplicate_ids},
        "publish": {"status": "success", "artifact": True},
    },
    "counts": {"records": len(items), "catalog_products": int(stats.get("products", 0) or 0), "increment": increment, "increment_date": today, "reviews": int(stats.get("reviews", 0) or 0)},
    "note": "Persisted LetsCart catalog and price snapshot; source service is LetsCart, not deprecated LetsBuy.",
}
out = ROOT / "data/observability/latest.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"LetsCart records observed: {len(items)}; increment: {increment}")
