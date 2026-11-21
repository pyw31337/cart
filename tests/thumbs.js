// letsbuy-thumbs 사진 재사용 해석기 — 해시 주소·후보 속성·폴백 규칙
const t = require('../assets/thumbs.js');
let f = 0;
const eq = (a, b, n) => { if (a !== b) { f++; console.log('FAIL', n, JSON.stringify(a)); } };
const ok = (v, n) => { if (!v) { f++; console.log('FAIL', n); } };

const H = '0123456789abcdef0123456789abcdef';
eq(t.url(H), 'https://letsbuy-thumbs.pyw213.workers.dev/t/' + H + '.webp', 'url');
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

// 브라우저 밖(document 없음)에서 prime 은 조용히 아무 것도 하지 않는다
t.prime();

console.log(f ? `THUMBS ${f} FAILED` : 'THUMBS ALL PASS');
process.exit(f ? 1 : 0);
