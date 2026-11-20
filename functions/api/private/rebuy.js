// GET /api/private/rebuy — 재구매 알림 + 절감 분석 (54개 상품군)
import { requireAccess } from '../../_lib/access.js';
import { json, fail } from '../../_lib/http.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    await requireAccess(request, env);
    const db = env.DB;
    if (!db) return fail(new Error('D1 binding missing'));

    const [res, media] = await db.batch([
      db.prepare(`SELECT a.product_id, a.match_product_id, a.market_code, a.buy_count, a.avg_cycle_days,
                         a.last_bought, a.next_expected, a.avg_price_krw, a.min_price_krw, a.max_price_krw,
                         a.target_price_krw, a.alert_state,
                         p.canonical_name, p.category_path,
                         s.danawa_name, s.spec_summary, s.rating, s.review_count, s.low_price_krw, s.product_url
                  FROM rebuy_alerts a
                  LEFT JOIN products p ON p.product_id = a.match_product_id
                  LEFT JOIN danawa_specs s ON s.product_id = a.match_product_id`),
      db.prepare(`SELECT pm.product_id, ma.r2_key FROM product_media pm
                  JOIN media_assets ma ON ma.media_id = pm.media_id WHERE pm.role = 'primary'`),
    ]);
    const mMap = Object.fromEntries((media.results || []).map((m) => [m.product_id, m.r2_key]));
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const dayOf = (iso) => Math.round((new Date(iso + 'T00:00:00Z') - new Date(today + 'T00:00:00Z')) / 86400000);

    const rows = (res.results || []).map((a) => {
      const d = a.next_expected ? dayOf(a.next_expected.slice(0, 10)) : null;
      const saving = (a.avg_price_krw && a.min_price_krw && a.avg_price_krw > a.min_price_krw)
        ? a.avg_price_krw - a.min_price_krw : 0;
      return {
        id: a.product_id,
        label: a.canonical_name || a.product_id,
        danawaName: a.danawa_name,
        category: (a.category_path || '').split('>')[0].trim() || null,
        market: a.market_code,
        buys: a.buy_count,
        cycle: a.avg_cycle_days,
        last: a.last_bought,
        next: a.next_expected,
        daysLeft: d,
        avg: a.avg_price_krw, min: a.min_price_krw, max: a.max_price_krw, target: a.target_price_krw,
        now: a.low_price_krw,
        rating: a.rating, reviews: a.review_count,
        spec: a.spec_summary,
        url: a.product_url,
        media: a.match_product_id ? (mMap[a.match_product_id] || null) : null,
        saving,
        savingPct: a.avg_price_krw ? Math.round((1000 * saving) / a.avg_price_krw) / 10 : 0,
        state: d === null ? 'unknown'
          : d < -30 ? 'stale'
          : d <= 0 ? 'due'
          : d <= 14 ? 'soon' : 'watching',
      };
    });

    const byDue = rows.filter((r) => r.daysLeft !== null && r.daysLeft >= -30 && r.daysLeft <= 21)
      .sort((a, b) => a.daysLeft - b.daysLeft);
    const bySaving = rows.slice().sort((a, b) => b.saving - a.saving);

    return json({
      ok: true,
      count: rows.length,
      due: rows.filter((r) => r.daysLeft !== null && r.daysLeft <= 0 && r.daysLeft >= -30).length,
      soon: rows.filter((r) => r.daysLeft !== null && r.daysLeft > 0 && r.daysLeft <= 14).length,
      stale: rows.filter((r) => r.state === 'stale').length,
      potential: rows.reduce((s, r) => s + r.saving, 0),
      rows,
      byDue: byDue.slice(0, 12),
      bySaving: bySaving.filter((r) => r.saving > 0).slice(0, 12),
    });
  } catch (e) {
    return fail(e);
  }
}
