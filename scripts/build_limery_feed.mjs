#!/usr/bin/env node
// 렛츠카트 → 라임리 연동 피드 (data/limery.json · schema letscart.limery.v1) — 2026-11-28
//   영우님: "모든 구매 거래내역은 렛츠카트에서 관리하고, 라임리는 렛츠카트 정보를 연동해서 보여 준다.
//            렛츠카트가 부족한 부분이 있으면 라임리에서 연동하기 좋은 구조로 개선해 줘."
//
// 왜 따로 만드나
//   · data/catalog.json(맥 export_web.py 생성)은 렛츠카트 화면용이라 사진이 없는 상품(약 1/3)은 화면에서
//     썸네일 서버(/thumbs)를 그때그때 물어 채운다. 라임리는 그 해석기를 갖고 있지 않아 사진이 빈다.
//   · 재구매 트래커(data.json)와 카탈로그의 ID 체계가 달라(gomgom-milk ↔ 곰곰-신선한-1a-우유) 이어지지 않는다.
//   · 상품을 어느 플랫폼에서 사는지(쿠팡·컬리…)와 가격 추이가 한곳에 모여 있지 않다.
//   이 피드는 위 셋을 미리 풀어 둔 '읽기 전용 공개 피드'다. 개인 주문 상세(주소·결제·주문번호)는 넣지 않는다.
//
// 사용: node scripts/build_limery_feed.mjs [--offline]   (--offline: 썸네일 서버를 묻지 않음)
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const core = require(path.join(ROOT, 'assets/engine/core.js'));
const SITE = 'https://letscart.pages.dev';
const OFFLINE = process.argv.includes('--offline');

const read = (p) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));
const catalog = read('data/catalog.json');
const tracker = read('data.json');
const mediaBase = String(catalog.mediaBase || `${SITE}/media/`).replace(/\/?$/, '/');

const MARKET_OF = [[/coupang\.com/, 'coupang'], [/kurly\.com/, 'kurly'], [/gmarket\.co\.kr/, 'gmarket'], [/auction\.co\.kr/, 'auction'],
  [/11st\.co\.kr/, '11st'], [/ssg\.com/, 'ssg'], [/lotteon\.com/, 'lotteon'], [/naver\.com/, 'naver'], [/ohou\.se/, 'ohou'], [/danawa\.com/, 'danawa']];
const marketOf = (url) => (MARKET_OF.find(([re]) => re.test(String(url || ''))) || [])[1] || null;
const LOGOS = new Set(['11st', 'auction', 'baemin', 'coupang', 'danawa', 'enuri', 'gmarket', 'kurly', 'lotteon', 'megamart', 'naver', 'npay', 'ohou', 'ssg']);
const vendorItem = (url) => (String(url || '').match(/vendorItemId=(\d+)|goods\/(\d+)|itemId=(\d+)|products\/(\d+)/) || []).slice(1).find(Boolean) || null;

// 트래커(data.json) ↔ 카탈로그 잇기: ① 같은 상품 URL(판매처 상품번호) ② 정규화 이름 키 ③ 이름 유사도
const keyOf = (n) => core.keyOf(n) || core.normName?.(n) || String(n || '');
const byVendor = new Map(); const byKey = new Map();
for (const t of tracker) {
  const v = vendorItem(t.url); if (v) byVendor.set(v, t);
  byKey.set(keyOf(t.title), t);
}
function trackerOf(p) {
  for (const m of p.markets || []) { const v = vendorItem(m.url); if (v && byVendor.has(v)) return byVendor.get(v); }
  const k = keyOf(p.name); if (byKey.has(k)) return byKey.get(k);
  if (!p.tracker) return null;
  let best = null; let bs = 0;
  for (const t of tracker) { const s = core.sim ? core.sim(p.name, t.title) : 0; if (s > bs) { bs = s; best = t; } }
  return bs >= 0.5 ? best : null;
}

// 사진 없는 상품 → 렛츠바이 공유 썸네일(R2) 이름 해시로 존재 확인
async function thumbsFor(names) {
  const hashOf = new Map();
  for (const n of names) hashOf.set(n, await core.thumbHash(keyOf(n) || n));
  if (OFFLINE) return new Map();
  const hs = [...new Set(hashOf.values())].filter(Boolean); const have = new Set();
  for (let i = 0; i < hs.length; i += 300) {
    try {
      const r = await fetch(`${SITE}/thumbs/has?h=${hs.slice(i, i + 300).join(',')}`, { headers: { 'User-Agent': 'letscart-limery-feed' } });
      if (r.ok) for (const h of (await r.json()).have || []) have.add(h);
    } catch (e) { console.warn('thumbs/has 실패', e.message); }
  }
  return new Map([...hashOf].filter(([, h]) => have.has(h)).map(([n, h]) => [n, `${SITE}/thumbs/t/${h}.webp`]));
}

const ps = catalog.products || [];
const thumbs = await thumbsFor(ps.filter((p) => !p.media).map((p) => p.name));
const usedTracker = new Set();
const products = ps.map((p) => {
  const t = trackerOf(p); if (t) usedTracker.add(t.id);
  const hist = (p.history || []).filter((h) => h.date && h.price);
  const purchases = hist.filter((h) => h.source === 'purchase').map((h) => ({ date: h.date.slice(0, 10), price: h.price }));
  const live = (t?.history || []).map((h) => ({ date: String(h.date).slice(0, 10), price: h.price, source: 'tracker' }));
  const priceHistory = [...hist.filter((h) => h.source !== 'purchase').map((h) => ({ date: h.date.slice(0, 10), price: h.price, source: h.source || 'price' })), ...live]
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const platforms = (p.markets || []).map((m) => ({ code: m.code, label: m.label, url: m.url, price: m.price, date: m.date, status: m.status }));
  if (t?.url && !platforms.some((m) => m.url === t.url)) { const c = marketOf(t.url); platforms.push({ code: c, label: (catalog.markets || []).find((x) => x.code === c)?.name || c, url: t.url, price: t.livePrice, date: t.liveDate }); }
  const img = p.media ? mediaBase + p.media : thumbs.get(p.name) || null;
  const rb = p.rebuy || null; const tr = p.tracker || null;
  return {
    id: p.id, ids: [p.id, t?.id].filter(Boolean), name: p.name, brand: p.brand || '', group: p.group || '', category: p.category || tr?.category || '',
    img, img_source: p.media ? 'danawa' : img ? 'thumbs' : null,
    spec: p.spec || '', spec_table: (p.specTable || []).filter((r) => r.v),
    rating: p.rating ?? null, reviews: p.reviews ?? null, price: p.price ?? t?.livePrice ?? null, offers: p.offers ?? null,
    price_url: p.danawaUrl || null, platforms, main_platform: platforms[0]?.code || null,
    purchases, purchase_count: purchases.length || t?.count || 0, last_purchase: purchases.at(-1)?.date || t?.lastDate || null,
    price_history: priceHistory,
    rebuy: rb || tr || t ? { cycle_days: rb?.cycle ?? tr?.cycleDays ?? t?.cycleDays ?? null, next: rb?.next ?? tr?.nextDate ?? t?.nextDate ?? null,
      target: rb?.target ?? tr?.targetPrice ?? t?.targetPrice ?? null, min: rb?.min ?? tr?.minPrice ?? t?.minPrice ?? null, max: rb?.max ?? tr?.maxPrice ?? t?.maxPrice ?? null,
      avg: rb?.avg ?? tr?.avgPrice ?? t?.avgPrice ?? null, unit: tr?.unit || t?.unitLabel || null, note: tr?.note || null } : null,
  };
});
// 카탈로그에 없는 트래커 품목도 빠뜨리지 않는다(라임리 '다시 살 때 된 물건'이 모두 이어지도록)
for (const t of tracker) {
  if (usedTracker.has(t.id)) continue;
  const c = marketOf(t.url);
  products.push({ id: t.id, ids: [t.id], name: t.title, brand: '', group: t.category || '', category: t.category || '', img: null, img_source: null,
    spec: '', spec_table: [], rating: null, reviews: null, price: t.livePrice ?? null, offers: null, price_url: null,
    platforms: [{ code: c, label: (catalog.markets || []).find((x) => x.code === c)?.name || c, url: t.url, price: t.livePrice, date: t.liveDate }], main_platform: c,
    purchases: (t.history || []).map((h) => ({ date: String(h.date).slice(0, 10), price: h.price })), purchase_count: t.count || 0, last_purchase: t.lastDate || null,
    price_history: [], rebuy: { cycle_days: t.cycleDays, next: t.nextDate, target: t.targetPrice, min: t.minPrice, max: t.maxPrice, avg: t.avgPrice, unit: t.unitLabel, note: null } });
}
const lateThumbs = await thumbsFor(products.filter((p) => !p.img).map((p) => p.name));
for (const p of products) if (!p.img && lateThumbs.get(p.name)) { p.img = lateThumbs.get(p.name); p.img_source = 'thumbs'; }

const markets = (catalog.markets || []).map((m) => ({ ...m, logo: LOGOS.has(m.code) ? `${SITE}/assets/logos/${m.code}.webp` : null }));
const feed = {
  schema: 'letscart.limery.v1', generatedAt: new Date().toISOString(), catalogGeneratedAt: catalog.generatedAt || null,
  note: '라임리 연동용 공개 피드. 상품 정보·사진·스펙·구매 날짜와 가격·가격 추이·판매처만 담고, 주소·결제수단·주문번호는 담지 않습니다.',
  markets,
  stats: { products: products.length, with_image: products.filter((p) => p.img).length, image_from_thumbs: products.filter((p) => p.img_source === 'thumbs').length,
    with_spec: products.filter((p) => p.spec_table.length).length, with_platform: products.filter((p) => p.main_platform).length,
    with_rebuy: products.filter((p) => p.rebuy).length, tracker_linked: usedTracker.size, tracker_total: tracker.length },
  products,
};
writeFileSync(path.join(ROOT, 'data/limery.json'), JSON.stringify(feed));
console.log(JSON.stringify(feed.stats));
