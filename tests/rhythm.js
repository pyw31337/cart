// /my 히어로 머리 숫자 · 레인 · '이번 달 살 때 온 품목' 보드 · '살 때 판정' 패널이
// 같은 집계(ACT.tally)에서 나오는지 고정한다. 숫자가 서로 어긋나면 여기서 먼저 깨진다.
const ACT = require('../assets/engine/action.js');
let fail = 0;
const assert = (ok, msg) => { if (!ok) { fail++; console.log('FAIL', msg); } };

// 실제 분포를 흉내 낸 표본 — 5가지 판정 × 경계값(21/22, null)
const rows = [
  { id: 'b1', daysLeft: null, k: 'buy' },   // 주기 산출 전 + 지금 사세요
  { id: 'b2', daysLeft: -3, k: 'buy' },
  { id: 'b3', daysLeft: 9, k: 'buy' },
  { id: 'b4', daysLeft: 21, k: 'buy' },     // 창 경계(포함)
  { id: 'b5', daysLeft: 64, k: 'buy' },     // 창 밖
  { id: 's1', daysLeft: 0, k: 'soon' },
  { id: 's2', daysLeft: 14, k: 'soon' },
  { id: 'd1', daysLeft: -1, k: 'due' },
  { id: 'd2', daysLeft: -28, k: 'due' },
  { id: 'd3', daysLeft: 0, k: 'due' },
  { id: 'w1', daysLeft: null, k: 'wait' },
  { id: 'w2', daysLeft: 8, k: 'wait' },
  { id: 'w3', daysLeft: 22, k: 'wait' },    // 창 경계(제외)
  { id: 'w4', daysLeft: 269, k: 'wait' },
  { id: 'o1', daysLeft: null, k: 'ok' },
  { id: 'o2', daysLeft: 7, k: 'ok' },
  { id: 'o3', daysLeft: 21, k: 'ok' },
  { id: 'o4', daysLeft: 50, k: 'ok' }
];
const judge = (r) => ({ verdict: { k: r.k }, meta: { k: r.k, cls: 'act-' + r.k, label: r.k } });

const t = ACT.tally(rows, judge, { winDays: 21 });
const sum = (o) => Object.keys(o).reduce((s, k) => s + o[k], 0);

// 1) 판정 5상태 합계 = 추적 품목 수 (살 때 판정 패널의 합)
assert(t.total === rows.length, 'total ' + t.total + ' != ' + rows.length);
assert(sum(t.by) === t.total, '판정 합계 ' + sum(t.by) + ' != 추적 ' + t.total);
assert(t.by.buy === 5 && t.by.soon === 2 && t.by.due === 3 && t.by.wait === 4 && t.by.ok === 4,
  '판정 분포 ' + JSON.stringify(t.by));

// 2) 히어로 머리 숫자 = 레인 3개 합 = 보드 3열 합
const board = { buy: 0, due: 0, wait: 0 };
rows.forEach((r) => {
  const a = judge(r);
  const k = a && a.verdict && a.verdict.k;
  if (!k || !Object.prototype.hasOwnProperty.call(board, k)) return;
  if (r.daysLeft != null && r.daysLeft > t.winDays) return;
  board[k]++;
});
assert(t.monthTotal === board.buy + board.due + board.wait,
  '머리 ' + t.monthTotal + ' != 보드 ' + (board.buy + board.due + board.wait));
assert(t.month.buy === board.buy && t.month.due === board.due && t.month.wait === board.wait,
  '레인 ' + JSON.stringify(t.month) + ' != 보드 ' + JSON.stringify(board));
assert(t.monthTotal === sum(t.month), '머리 ' + t.monthTotal + ' != 레인 합 ' + sum(t.month));
assert(t.monthTotal === 4 + 3 + 2, '이번 달 합 ' + t.monthTotal + ' != 9');

// 3) 창 경계·주기 미산출 처리
assert(t.month.buy === 4, 'D-21 경계(21 포함·64 제외) buy ' + t.month.buy);
assert(t.month.wait === 2, 'D-21 경계(22 제외·null 포함) wait ' + t.month.wait);
assert(t.unknown === 3, '주기 미산출 ' + t.unknown + ' != 3');
assert(t.outside === t.total - t.monthTotal, '나머지 ' + t.outside);

// 4) 판정이 없거나 던져도 '보통 가격'으로 세어 합계가 줄지 않는다
const t2 = ACT.tally([{ id: 'x', daysLeft: 5 }, { id: 'y', daysLeft: -1, k: 'buy' }, { id: 'z', daysLeft: 1 }],
  (r) => { if (r.id === 'z') throw new Error('boom'); return r.id === 'x' ? null : { verdict: { k: 'buy' } }; }, {});
assert(t2.total === 3 && t2.by.ok === 2 && t2.by.buy === 1, '판정 없음/예외 처리 ' + JSON.stringify(t2.by));

// 5) 빈 목록
const t3 = ACT.tally([], judge, {});
assert(t3.total === 0 && t3.monthTotal === 0 && t3.outside === 0, '빈 목록');

// 6) 실제 엔진 판정과 함께: 창 필터가 판정 종류를 바꾸지 않는다
const judged = ACT.judge({
  key: 'k', name: '깨끗한나라 3겹 데코 화장지 30m 30롤', mine: [],
  ref: { price: 19900, label: '평균 구매가' }, last: '2026-10-01',
  now: { date: '2026-11-22', price: 15900, src: '다나와', title: '깨끗한나라 3겹 데코 화장지 30m 30롤' },
  count: 4, cycleDays: 30, daysLeft: 3
}, '2026-11-22');
const t4 = ACT.tally([{ id: 'k', daysLeft: 3 }], () => judged, {});
assert(t4.total === 1 && (t4.by[judged.verdict.k] || 0) === 1, '엔진 판정 ' + judged.verdict.k);
const inMonth = ['buy', 'due', 'wait'].indexOf(judged.verdict.k) >= 0;
assert(t4.monthTotal === (inMonth ? 1 : 0), '엔진 판정이 이번 달 창에 ' + t4.monthTotal + '으로 셈');

console.log(fail ? fail + ' FAILED' : 'RHYTHM ALL PASS (' + t.total + '표본 · 이번 달 ' + t.monthTotal + ' · 판정 ' + JSON.stringify(t.by) + ')');
process.exit(fail ? 1 : 0);
