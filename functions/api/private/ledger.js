// GET /api/private/ledger?q=&market=&match=&from=&to=&limit=&offset=
// 가계부 온라인 쇼핑 지출 + 실주문 대조 정보
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
    const limit = int(u.searchParams.get('limit'), 50, 200);
    const offset = int(u.searchParams.get('offset'), 0, 200000);

    const where = [];
    const binds = [];
    if (market) { where.push('l.market_code = ?'); binds.push(market); }
    if (from) { where.push('l.tx_date >= ?'); binds.push(from); }
    if (to) { where.push('l.tx_date <= ?'); binds.push(to); }
    if (q) { where.push('(l.item LIKE ? OR l.memo LIKE ?)'); binds.push('%' + q + '%', '%' + q + '%'); }
    if (match === 'matched') where.push('m.order_id IS NOT NULL');
    else if (match === 'unmatched') where.push('m.order_id IS NULL');
    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const base = `FROM ledger_shopping l
                  LEFT JOIN ledger_matches m ON m.entry_id = l.entry_id
                  LEFT JOIN orders o ON o.order_id = m.order_id ${w}`;

    const [cnt, sum, list] = await db.batch([
      db.prepare(`SELECT COUNT(*) AS n ${base}`).bind(...binds),
      db.prepare(`SELECT SUM(l.amount_krw) AS total ${base}`).bind(...binds),
      db.prepare(`SELECT l.entry_id, l.tx_date, l.year_month, l.market_code, l.item, l.category,
                         l.amount_krw, l.payment_method, l.memo, l.confidence,
                         m.order_id, m.method, m.score, m.date_delta, m.amount_delta,
                         o.order_date AS order_date, o.paid_total_krw AS order_total, o.status AS order_status
                  ${base} ORDER BY l.tx_date DESC, l.amount_krw DESC LIMIT ? OFFSET ?`).bind(...binds, limit, offset),
    ]);

    return json({
      ok: true,
      total: (cnt.results && cnt.results[0]) ? cnt.results[0].n : 0,
      sum: (sum.results && sum.results[0]) ? (sum.results[0].total || 0) : 0,
      limit, offset,
      rows: (list.results || []).map((r) => ({
        id: r.entry_id, date: r.tx_date, month: r.year_month, market: r.market_code,
        color: colors[r.market_code] || '#8B95A1',
        item: r.item, category: r.category, amount: r.amount_krw, payment: r.payment_method,
        memo: r.memo, confidence: r.confidence,
        order: r.order_id ? {
          id: r.order_id, date: r.order_date, total: r.order_total, status: r.order_status,
          method: r.method, score: r.score, dateDelta: r.date_delta, amountDelta: r.amount_delta,
        } : null,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}
