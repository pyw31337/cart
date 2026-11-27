// 렛츠카트 썸네일 캐시 해석기 — 해시 주소·후보 속성·폴백 규칙
const core = require('../assets/engine/core.js');
global.self = global;
global.LetsCartCore = core;
const t = require('../assets/thumbs.js');
let f = 0;
const eq = (a, b, n) => { if (a !== b) { f++; console.log('FAIL', n, JSON.stringify(a), JSON.stringify(b)); } };
const ok = (v, n) => { if (!v) { f++; console.log('FAIL', n); } };

const H = '0123456789abcdef0123456789abcdef';
eq(t.url(H), 'https://letscart.pages.dev/thumbs/t/' + H + '.webp', 'url');
ok(/^https:\/\//.test(t.API), 'api https');

// 후보 이름은 중복·빈 값을 빼고, 숫자·용량 표기가 달라도 같은 키를 쓸 수 있게 JSON 으로 넣는다.
const attr = t.attr([' 이나바 퐁츄르 35g ', '이나바 퐁츄르 35g', '', null]);
ok(attr.startsWith(' data-thumbs="'), 'attr prefix');
const list = JSON.parse(decodeURIComponent(attr.split('"')[1]));
eq(list.length, 1, 'attr dedupe/trim');
eq(list[0], '이나바 퐁츄르 35g', 'attr name');
eq(t.attr([]), '', 'attr empty');
eq(t.attr(null), '', 'attr null');
ok(!/["<>]/.test(attr.split('"')[1]), 'attr value safe for html');

// 4개까지만 후보로 둔다(요청 길이·오탐 제한)
eq(JSON.parse(decodeURIComponent(t.attr(['a', 'b', 'c', 'd', 'e']).split('"')[1])).length, 4, 'attr cap');

// slot: 태그·클래스·속성을 한 번에
const s = t.slot(['서울우유 1L'], '<svg></svg>', 'div', 'item-thumb');
ok(s.startsWith('<div class="item-thumb" data-thumbs="'), 'slot open');
ok(s.endsWith('</div>'), 'slot close');
ok(s.includes('<svg></svg>'), 'slot inner');

(async () => {
  // 이름표는 반드시 '정규화 키(keyOf)'의 해시여야 한다. 원문을 해시하면 렛츠바이가 올린 사진과 한 건도 맞지 않는다.
  const want = await core.thumbHash(core.keyOf('오리온 초코파이 정 444g'));
  eq(await t.hashOf('오리온 초코파이 정 444g'), want, 'hash = thumbHash(keyOf(name))');
  eq(await t.hashOf('오리온 초코파이 정 468g'), want, 'capacity variant same key');
  eq(await t.hashOf('오리온 초코파이 정 444g'), want, 'hash cached + stable');
  ok((await t.hashOf('')).length === 0, 'empty name no hash');

  // 브라우저 밖(document 없음)에서 prime 은 조용히 아무 것도 하지 않는다
  t.prime();
  if (global.LCThumbs !== t) { f++; console.log('FAIL global expose'); }
  console.log(f ? `THUMBS ${f} FAILED` : 'THUMBS ALL PASS');
  process.exit(f ? 1 : 0);
})();
