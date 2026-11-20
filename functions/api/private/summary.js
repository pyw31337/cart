// GET /api/private/summary — 개인 지출·주문·재구매 요약 (Cloudflare Access 필수)
import { requireAccess } from '../../_lib/access.js';
import { json, fail } from '../../_lib/http.js';

const MARKETS = {
  coupang: ['쿠팡', '#E52528'], kurly: ['컬리', '#6B21A8'], gmarket: ['지마켓', '#0B8A4B'],
  naver: ['네이버쇼핑', '#03C75A'], '11st': ['11번가', '#FF0038'], aliexpress: ['알리익스프레스', '#FF4747'],
  lotteon: ['롯데온', '#E60013'], ohou: ['오늘의집', '#00A5AD'], temu: ['테무', '#FB7701'],
  gsshop: ['GS SHOP', '#0B5AA5'], ssg: ['SSG닷컴', '#C8102E'], amazon: ['아마존', '#FF9900'],
  auction: ['옥션', '#E5261F'], wemakeprice: ['위메프', '#8E2DE2'], tmon: ['티몬', '#FF5A5F'],
  interpark: ['인터파크', '#1D7FE0'], emart: ['이마트몰', '#FFB81C'], homeplus: ['홈플러스', '#E60012'],
  lotte_hs: ['롯데홈쇼핑', '#D6001C'], malltail: ['몰테일', '#0F4C81'],
};

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const identity = await requireAccess(request, env);
    const db = env.DB;
    if (!db) return fail(new Error('D1 binding missing'));

    const [ledger, orders, items, match, alerts, collection] = await db.batch([
      db.prepare(`SELECT market_code, COUNT(*) AS rows, SUM(amount_krw) AS total,
                         MIN(tx_date) AS first, MAX(tx_date) AS last
                  FROM ledger_shopping GROUP BY market_code`),
      db.prepare(`SELECT market_code, COUNT(*) AS orders, SUM(paid_total_krw) AS total,
                         MIN(order_date) AS first, MAX(order_date) AS last
                  FROM orders GROUP BY market_code`),
      db.prepare(`SELECT COUNT(*) AS items FROM order_items WHERE valid = 1`),
      db.prepare(`SELECT market_code, COUNT(*) AS rows,
                         SUM(CASE WHEN order_id IS NOT NULL THEN 1 ELSE 0 END) AS matched
                  FROM ledger_matches GROUP BY market_code`),
      db.prepare(`SELECT a.product_id, a.match_product_id, a.market_code, a.buy_count, a.avg_cycle_days,
                         a.last_bought, a.next_expected, a.avg_price_krw, a.min_price_krw, a.max_price_krw,
                         a.target_price_krw, a.alert_state,
                         s.low_price_krw, s.rating, s.review_count
                  FROM rebuy_alerts a
                  LEFT JOIN danawa_specs s ON s.product_id = a.match_product_id
                  ORDER BY CASE WHEN a.next_expected IS NULL THEN 1 ELSE 0 END, a.next_expected ASC`),
      db.prepare(`SELECT * FROM market_collection_status ORDER BY market_code`),
    ]);

    const lo = orders.results || [];
    const it = (items.results && items.results[0]) ? items.results[0].items : 0;
    const ma = Object.fromEntries((match.results || []).map((r) => [r.market_code, r]));
    const markets = [];
    let ledgerTotal = 0, ledgerRows = 0, matched = 0;
    (ledger.results || []).forEach((r) => {
      const o = lo.find((x) => x.market_code === r.market_code) || {};
      const m = ma[r.market_code] || { matched: 0, rows: r.rows };
      ledgerTotal += r.total || 0;
      ledgerRows += r.rows || 0;
      matched += m.matched || 0;
      markets.push({
        code: r.market_code,
        name: (MARKETS[r.market_code] || [r.market_code, '#8B95A1'])[0],
        color: (MARKETS[r.market_code] || ['', '#8B95A1'])[1],
        ledgerRows: r.rows || 0, ledgerTotal: r.total || 0, first: r.first, last: r.last,
        orders: o.orders || 0, orderTotal: o.total || 0,
        matched: m.matched || 0,
        matchPct: r.rows ? Math.round((1000 * (m.matched || 0)) / r.rows) / 10 : 0,
      });
    });
    lo.filter((r) => !markets.some((m) => m.code === r.market_code)).forEach((r) => {
      markets.push({
        code: r.market_code,
        name: (MARKETS[r.market_code] || [r.market_code, '#8B95A1'])[0],
        color: (MARKETS[r.market_code] || ['', '#8B95A1'])[1],
        ledgerRows: 0, ledgerTotal: 0, orders: r.orders || 0, orderTotal: r.total || 0,
        matched: 0, matchPct: 0,
      });
    });
    markets.sort((a, b) => b.ledgerTotal - a.ledgerTotal || b.orderTotal - a.orderTotal);

    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const dayOf = (iso) => Math.round((new Date(iso + 'T00:00:00Z') - new Date(today + 'T00:00:00Z')) / 86400000);
    const due = [];
    const savings = [];
    let overdue = 0;
    (alerts.results || []).forEach((a) => {
      const d = a.next_expected ? dayOf(a.next_expected.slice(0, 10)) : null;
      const row = Object.assign({}, a, {
        days_left: d,
        label: a.product_id,
        low_price_krw: a.low_price_krw,
      });
      if (d !== null && d >= -30 && d <= 21) due.push(row);
      else if (d !== null) overdue++;
      if (a.avg_price_krw && a.min_price_krw && a.avg_price_krw > a.min_price_krw) {
        row.saving = a.avg_price_krw - a.min_price_krw;
        row.saving_pct = Math.round((1000 * row.saving) / a.avg_price_krw) / 10;
        savings.push(row);
      }
    });
    due.sort((a, b) => (a.days_left === null ? 9999 : a.days_left) - (b.days_left === null ? 9999 : b.days_left));
    savings.sort((a, b) => b.saving - a.saving);

    const orderTotal = lo.reduce((s, r) => s + (r.total || 0), 0);
    return json({
      ok: true,
      identity: identity.email,
      generatedAt: new Date().toISOString(),
      totals: {
        ledgerRows, ledgerTotal,
        orders: lo.reduce((s, r) => s + (r.orders || 0), 0),
        items: it, orderTotal,
        matched, matchPct: ledgerRows ? Math.round((1000 * matched) / ledgerRows) / 10 : 0,
        rebuy: (alerts.results || []).length,
        dueSoon: due.filter((x) => x.days_left !== null && x.days_left <= 14).length,
        overdue,
        savingPotential: savings.reduce((s, x) => s + x.saving, 0),
        firstLedger: (ledger.results || []).map((r) => r.first).filter(Boolean).sort()[0] || null,
        lastLedger: (ledger.results || []).map((r) => r.last).filter(Boolean).sort().pop() || null,
      },
      markets,
      due: due.slice(0, 8),
      savings: savings.slice(0, 8),
      collection: (collection.results || []).map((c) => Object.assign({}, c, {
        name: (MARKETS[c.market_code] || [c.market_code])[0],
      })),
    });
  } catch (e) {
    return fail(e);
  }
}
