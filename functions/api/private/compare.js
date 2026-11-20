// GET /api/private/compare — 자주 사는 상품군별 내 구매 기록 (Cloudflare Access 필수)
// 공개 라이벌 카탈로그(data/rivals.json)의 match 토큰으로 D1 주문 라인을 찾아
// '내 단위가격·구매주기·가격 추이'를 브라우저에서 계산할 수 있게 원장 행만 돌려준다.
// 쓰기 없음(SELECT only) · 개인 데이터는 Access 통과 후에만 응답한다.
import { requireAccess } from '../../_lib/access.js';
import { json, fail } from '../../_lib/http.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    await requireAccess(request, env);
    const db = env.DB;
    if (!db) return fail(new Error('D1 binding missing'));

    // 같은 배포의 공개 카탈로그에서 상품군 정의를 읽는다(개인정보 없음).
    let groups = [];
    try {
      const res = await env.ASSETS.fetch(new URL('/data/rivals.json', request.url));
      if (res.ok) groups = (await res.json()).groups || [];
    } catch (e) {
      groups = [];
    }
    if (!groups.length) return fail(new Error('rivals catalog unavailable'));

    const stmts = groups.map((g) => {
      const keys = (g.match || []).filter(Boolean).slice(0, 4);
      if (!keys.length) return null;
      const where = keys.map(() => 'i.product_raw LIKE ?').join(' OR ');
      return db.prepare(
        `SELECT o.order_date AS d, i.product_raw AS n, i.paid_krw AS p, i.qty AS q, o.market_code AS m
           FROM order_items i JOIN orders o ON o.order_id = i.order_id
          WHERE i.valid = 1 AND i.paid_krw > 0 AND (${where})
          ORDER BY o.order_date DESC LIMIT 24`
      ).bind(...keys.map((k) => `%${k}%`));
    });
    const results = await db.batch(stmts.filter(Boolean));

    const out = [];
    let i = 0;
    groups.forEach((g) => {
      if (!(g.match || []).length) { out.push({ id: g.id, orders: [] }); return; }
      const r = results[i++];
      out.push({
        id: g.id,
        orders: (r.results || []).map((x) => ({
          date: x.d, name: x.n, price: x.p, qty: x.q || 1, mall: x.m,
        })),
      });
    });

    return json({ ok: true, generatedAt: new Date().toISOString(), groups: out });
  } catch (e) {
    return fail(e);
  }
}
