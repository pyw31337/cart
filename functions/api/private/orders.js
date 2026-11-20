// GET /api/private/orders?q=&market=&from=&to=&match=&limit=&offset=
// 실제 주문 + 라인 + 매칭된 다나와 스펙/WebP + 가계부 대조 정보
import { requireAccess } from '../../_lib/access.js';
import { json, fail } from '../../_lib/http.js';

const colors = {
  coupang: '#E52528', kurly: '#6B21A8', gmarket: '#0B8A4B', naver: '#03C75A', '11st': '#FF0038',
  aliexpress: '#FF4747', lotteon: '#E60013', ohou: '#00A5AD', temu: '#FB7701', gsshop: '#0B5AA5',
  ssg: '#C8102E', amazon: '#FF9900', auction: '#E5261F',
};

function int(v, def, max) {
  const n = parseInt(v, 10);
  if (isNaN(n) || n < 0) return def;
  return Math.min(n, max);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    await requireAccess(request, env);
    const db = env.DB;
    if (!db) return fail(new Error('D1 binding missing'));
    const u = new URL(request.url);
    const q = (u.searchParams.get('q') || '').trim();
    const market = (u.searchParams.get('market') || '').trim();
    const from = (u.searchParams.get('from') || '').trim();
    const to = (u.searchParams.get('to') || '').trim();
    const match = (u.searchParams.get('match') || 'all').trim();
    const limit = int(u.searchParams.get('limit'), 40, 100);
    const offset = int(u.searchParams.get('offset'), 0, 100000);

    const where = [];
    const binds = [];
    if (market) { where.push('o.market_code = ?'); binds.push(market); }
    if (from) { where.push('o.order_date >= ?'); binds.push(from); }
    if (to) { where.push('o.order_date <= ?'); binds.push(to); }
    if (q) {
      where.push('(o.order_no LIKE ? OR EXISTS (SELECT 1 FROM order_items i2 WHERE i2.order_id = o.order_id AND i2.product_raw LIKE ?))');
      binds.push('%' + q + '%', '%' + q + '%');
    }
    if (match === 'matched') {
      where.push('EXISTS (SELECT 1 FROM ledger_matches m2 WHERE m2.order_id = o.order_id)');
    } else if (match === 'unmatched') {
      where.push('NOT EXISTS (SELECT 1 FROM ledger_matches m2 WHERE m2.order_id = o.order_id)');
    }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [cnt, list] = await db.batch([
      db.prepare(`SELECT COUNT(*) AS n FROM orders o ${w}`).bind(...binds),
      db.prepare(`SELECT o.order_id, o.market_code, o.order_no, o.order_date, o.status, o.status_detail,
                         o.paid_total_krw, o.line_count,
                         (SELECT COUNT(*) FROM ledger_matches m WHERE m.order_id = o.order_id) AS ledger_hits
                  FROM orders o ${w}
                  ORDER BY o.order_date DESC, o.order_id DESC
                  LIMIT ? OFFSET ?`).bind(...binds, limit, offset),
    ]);

    const rows = list.results || [];
    const ids = rows.map((r) => r.order_id);
    let items = [], prods = [], medias = [], ledgers = [];
    if (ids.length) {
      const ph = ids.map(() => '?').join(',');
      const [iRes, lRes] = await db.batch([
        db.prepare(`SELECT item_id, order_id, product_raw, option_name, qty, paid_krw, unit_price_krw,
                           item_status, product_url, product_id
                    FROM order_items WHERE valid = 1 AND order_id IN (${ph}) ORDER BY order_id, line_no`).bind(...ids),
        db.prepare(`SELECT m.order_id, m.method, m.score, m.date_delta, m.amount_delta,
                           l.entry_id, l.tx_date, l.amount_krw, l.item AS ledger_item, l.payment_method
                    FROM ledger_matches m JOIN ledger_shopping l ON l.entry_id = m.entry_id
                    WHERE m.order_id IN (${ph})`).bind(...ids),
      ]);
      items = iRes.results || [];
      ledgers = lRes.results || [];
      const pids = [...new Set(items.map((i) => i.product_id).filter(Boolean))];
      if (pids.length) {
        const pph = pids.map(() => '?').join(',');
        const [pRes, mRes] = await db.batch([
          db.prepare(`SELECT p.product_id, p.canonical_name, s.danawa_name, s.spec_summary, s.rating,
                             s.review_count, s.low_price_krw, s.product_url, s.category_path
                      FROM products p LEFT JOIN danawa_specs s ON s.product_id = p.product_id
                      WHERE p.product_id IN (${pph})`).bind(...pids),
          db.prepare(`SELECT pm.product_id, ma.r2_key FROM product_media pm
                      JOIN media_assets ma ON ma.media_id = pm.media_id
                      WHERE pm.role = 'primary' AND pm.product_id IN (${pph})`).bind(...pids),
        ]);
        prods = pRes.results || [];
        medias = mRes.results || [];
      }
    }

    const pMap = Object.fromEntries(prods.map((p) => [p.product_id, p]));
    const mMap = Object.fromEntries(medias.map((m) => [m.product_id, m.r2_key]));
    const iByOrder = {};
    items.forEach((i) => {
      const p = i.product_id ? pMap[i.product_id] : null;
      (iByOrder[i.order_id] = iByOrder[i.order_id] || []).push({
        item_id: i.item_id,
        name: i.product_raw,
        option: i.option_name,
        qty: i.qty,
        paid: i.paid_krw,
        unit: i.unit_price_krw,
        status: i.item_status,
        url: (p && p.product_url) || i.product_url,
        product: p ? {
          id: p.product_id,
          name: p.danawa_name || p.canonical_name,
          spec: p.spec_summary,
          rating: p.rating,
          reviews: p.review_count,
          low: p.low_price_krw,
          media: mMap[p.product_id] || null,
        } : null,
      });
    });
    const lByOrder = {};
    ledgers.forEach((l) => { (lByOrder[l.order_id] = lByOrder[l.order_id] || []).push(l); });

    const orders = rows.map((o) => ({
      id: o.order_id,
      market: o.market_code,
      color: colors[o.market_code] || '#8B95A1',
      no: o.order_no,
      date: o.order_date,
      status: o.status,
      detail: o.status_detail,
      total: o.paid_total_krw,
      lineCount: o.line_count,
      ledger: (lByOrder[o.order_id] || []).map((l) => ({
        entryId: l.entry_id, date: l.tx_date, amount: l.amount_krw, item: l.ledger_item,
        payment: l.payment_method, method: l.method, score: l.score,
        dateDelta: l.date_delta, amountDelta: l.amount_delta,
      })),
      items: iByOrder[o.order_id] || [],
    }));

    return json({
      ok: true,
      total: (cnt.results && cnt.results[0]) ? cnt.results[0].n : orders.length,
      limit, offset, orders,
    });
  } catch (e) {
    return fail(e);
  }
}
