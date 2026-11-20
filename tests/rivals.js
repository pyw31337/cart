const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 라이벌 비교 모듈·데이터 검증 (브라우저 없이 순수 함수 + JSON 무결성)
global.window = global;
global.LC = { sheet: function () {}, icon: function () { return ''; } };
require('../assets/rivals.js');
const R = global.LetsCartRivals;

let n = 0;
function ok(cond, msg) { assert(cond, msg); n++; }

/* 1. 단위 파서 — 실제 다나와 상품명 형태 */
const cases = [
  ['농심 신라면 120g (40개)', 'g', 4800, '100g당'],
  ['이나바 캣 챠오츄르 버라이어티팩 1260g (14g x 90p) (1개)', 'g', 1260, '100g당'],
  ['쿠팡 곰곰 신선한 우유 900ml (8개)', 'ml', 7200, '100ml당'],
  ['깨끗한나라 순수 프리미엄 30m (30롤) (3팩)', 'roll', 90, '1롤당'],
  ['크리넥스 울트라클린 천연펄프 3겹 고급롤화장지, 27m, 30개입, 1개', 'roll', 30, '1롤당'],
  ['한스웰 쁘띠루쥬 데일리 물티슈 캡형 100매 (20팩)', 'sheet', 2000, '100매당'],
  ['프로쉬 식기세척기세제 그린레몬 30개입 (3개)', 'ea', 90, '1개당'],
  ['맥심 티오피 마스터라떼 380mlX24캔', 'ml', 9120, '100ml당'],
  ['(1+1)프로쉬 올인원그린레몬식기세척기제 30P', 'ea', 30, '1개당']
];
cases.forEach(([name, kind, qty, label]) => {
  const u = R.unitOf(name);
  ok(u && u.kind === kind, '단위 종류: ' + name);
  ok(u && Math.round(u.qty) === qty, '단위 수량: ' + name + ' → ' + (u && u.qty));
  ok(u && u.label === label, '단위 라벨: ' + name);
});

/* 2. 내 구매 기록 집계 — 주기·평균·단위가격 */
const group = {
  id: 'tissue', label: '화장지', unitLabel: '1롤당', match: ['화장지'],
  products: [
    { name: '깨끗한나라 순수 프리미엄 30m 30롤', price: 38490, unitPrice: 428, unit: { kind: 'roll', qty: 90, per: 1, text: '90롤' }, brand: '깨끗한나라', rating: 4.7, reviews: 33161, spec: [], trend: [{ d: '2026-10-01', p: 39900 }, { d: '2026-11-20', p: 38490 }] },
    { name: '숨 소프트 블랙 30m 30롤 2팩', price: 17920, unitPrice: 299, unit: { kind: 'roll', qty: 60, per: 1, text: '60롤' }, brand: '숨', rating: 4.6, reviews: 58138, spec: [] },
    { name: '코디 라벤더 30m 30롤 3팩', price: 29900, unitPrice: 332, unit: { kind: 'roll', qty: 90, per: 1, text: '90롤' }, brand: '코디', rating: 4.7, reviews: 15596, spec: [] }
  ]
};
const orders = [
  { date: '2026-01-01', name: '깨끗한나라 3겹 데코 화장지 30m 30롤', price: 20500, qty: 1, mall: '쿠팡' },
  { date: '2026-03-01', name: '깨끗한나라 3겹 데코 화장지 30m 30롤', price: 19900, qty: 1, mall: '쿠팡' },
  { date: '2026-05-01', name: '깨끗한나라 3겹 데코 화장지 30m 30롤', price: 21500, qty: 1, mall: 'G마켓' },
  { date: '2026-07-01', name: '다른 상품 우유 1L', price: 3000, qty: 1, mall: '쿠팡' }
];
const my = R.myStats(orders, group);
ok(my.buys === 3, '내 구매 횟수는 매칭된 3회');
const exGroup = { id: 't', match: ['치약'], exclude: ['치약걸이'], products: [] };
const exMy = R.myStats([{ date: '2026-01-01', name: '치약걸이 2p 세트', price: 5000, qty: 1 }, { date: '2026-01-02', name: '페리오 치약 100g', price: 3000, qty: 1 }], exGroup);
ok(exMy.buys === 1, 'exclude 토큰(치약걸이)은 내 기록에서 뺀다');
ok(my.cycle === 60, '구매 주기 60일(중앙값)');
ok(my.avg === 20633, '평균 구매가');
ok(my.min === 19900 && my.max === 21500, '최저·최고 구매가');
ok(my.avgUnit && my.avgUnit > 500 && my.avgUnit < 800, '30롤 기준 1롤당 단위가격이 계산된다 (' + my.avgUnit + ')');
ok(my.next === '2026-06-30', '다음 예상 구매일 = 마지막 + 주기 (' + my.next + ')');

/* 3. 비교 계산 — 더 싼 라이벌과 차이율 */
const c = R.compare(group, my);
ok(c.best && c.best.brand === '숨', '라이벌 중 단위가격 최저는 숨');
ok(c.diff !== null && c.diff < 0, '라이벌이 더 싸면 음수 차이');
ok(c.rows.length === 3, '내 상품 + 라이벌 2종 행');

/* 4. HTML — 시스템 UI 0건, 단위가격·추이 문구 포함 */
const html = R.compareHTML(group, my, { range: 180 });
ok(!/<select/i.test(html), 'select 없음');
ok(!/alert\(|confirm\(|prompt\(/.test(html), '시스템 다이얼로그 없음');
ok(html.includes('1롤당'), '단위가격 라벨 노출');
ok(html.includes('가격 추이'), '가격 추이 섹션');
ok(html.includes('내 기록 3회'), '내 구매 횟수 노출');
const svg = R.chart([{ name: 'x', color: '#84F000', points: [{ d: '2026-10-01', v: 400 }, { d: '2026-11-01', v: 380 }] }], {});
ok(svg.includes('<svg') && svg.includes('path'), 'SVG 선 그래프 생성');

/* 4-2. 사진 우선 타일 — 20품목 모두 내 상품·라이벌 사진 2장 */
ok(/class="info"/.test(html) && /data-tip="/.test(html), 'ⓘ 툴팁 버튼 렌더');
ok(/aria-expanded="false"/.test(html) && /tabindex="0"/.test(html), '툴팁 접근성 속성');
ok(!/\stitle="/.test(html), 'OS 기본 title 속성 없음');
ok(/rv-hero/.test(html) && /class="shot/.test(html), '비교 시트 사진 VS 히어로');
ok(/rv-card-shot/.test(html), '상품 카드 대표 사진');

/* 5. 데이터 무결성 — 실제 수집분 20품목 × 3상품 */
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/rivals.json'), 'utf8'));
ok(data.groups.length === 20, '20개 품목');
ok(data.stats.products === 60, '60개 상품');
let withTrend = 0, withImg = 0, withRating = 0;
data.groups.forEach((g) => {
  ok(g.products.length === 3, g.id + ' — 내 상품 + 라이벌 2종');
  ok(g.products[0].role === 'base', g.id + ' — 첫 상품이 기준');
  ok(Array.isArray(g.match) && g.match.length > 0, g.id + ' — 내 기록 매칭 키');
  g.products.forEach((p) => {
    ok(/^https:\/\/prod\.danawa\.com\/info\/\?pcode=\d+/.test(p.url), g.id + ' — 다나와 실상품 URL');
    ok(p.price > 0, g.id + ' — 실제 최저가');
    ok(p.unit && p.unit.qty > 0, g.id + ' — 용량·수량 파싱');
    ok(p.unitPrice > 0, g.id + ' — 단위가격 계산');
    ok(p.observedAt === data.observedAt, g.id + ' — 관측일 기록');
    if (p.trend && p.trend.length > 1) withTrend++;
    if (p.image && p.image.startsWith('assets/media/rivals/')) withImg++;
    if (p.rating) withRating++;
  });
});
ok(withTrend >= 50, '가격 추이 2점 이상 상품 50개 이상 (' + withTrend + ')');
ok(withImg === 60, '480px WebP 썸네일 60개');
ok(withRating >= 50, '평점 보유 상품 50개 이상 (' + withRating + ')');
data.groups.forEach((g) => g.products.forEach((p) => {
  assert(fs.existsSync(path.join(__dirname, '..', p.image)), '이미지 파일 존재: ' + p.image);
}));

/* 6. 개인정보 — 공개 데이터에 주문번호·이메일·전화·주소 원문이 없다 */
const raw = JSON.stringify(data);
ok(!/주문번호|orderNo|@[a-z0-9.-]+\.(com|net|kr)/i.test(raw), '공개 라이벌 데이터에 개인 식별자 없음');
ok(!/010-\d{4}-\d{4}/.test(raw), '전화번호 없음');

/* 7. 페이지가 시스템 UI를 쓰지 않는다 */
['../index.html', '../my/index.html', '../local/index.html'].forEach((f) => {
  const s = fs.readFileSync(path.join(__dirname, f), 'utf8');
  ok(!/<select\b/i.test(s), f + ' — native select 없음');
});
['../assets/landing.js', '../my/my.js', '../local/local.js'].forEach((f) => {
  const s = fs.readFileSync(path.join(__dirname, f), 'utf8');
  ok(!/\balert\(|\bconfirm\(|\bprompt\(/.test(s), f + ' — alert/confirm/prompt 없음');
});

/* 8. 사진 보드·카피 길이 가드 (20품목 전부) */
const dataFull = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/rivals.json'), 'utf8'));
dataFull.groups.forEach((g) => {
  const t = R.tile(g, null);
  ok((t.match(/<img /g) || []).length === 2, g.id + ' — 타일에 사진 2장');
  ok(t.includes(g.products[0].image) && t.includes(g.products[1].image) || t.includes(g.products[2].image), g.id + ' — 실제 WebP 경로');
  ok(!/\stitle="/.test(t), g.id + ' — title 속성 없음');
  ok(t.includes('rv-vs') && t.includes('rv-tile-name'), g.id + ' — VS 보드 구조');
});

function visibleText(file) {
  let s = fs.readFileSync(path.join(__dirname, file), 'utf8');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/&[a-z#0-9]+;/gi, ' ');
  return s.replace(/\s+/g, ' ').trim();
}
const homeText = visibleText('../index.html');
ok(homeText.length < 1100, '랜딩 정적 카피 1,100자 미만 (' + homeText.length + ')');
ok(!/렛츠카트가 다른 점|주절주절|상품 DB 경쟁이 아니라/.test(homeText), '블로그식 서론 없음');
ok((visibleText('../local/index.html').length) < 2600, '/local 정적 카피 2,600자 미만');
ok((visibleText('../my/index.html').length) < 2300, '/my 정적 카피 2,300자 미만');

console.log('RIVALS ALL PASS (' + n + ' checks)');
