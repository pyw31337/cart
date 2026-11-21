/* 렛츠카트 엔진 · action: 할인 주기 예측(nextDip) + 4단 행동 판정 (브라우저/Node 공용)
   렛츠바이 v0.18.3 docs/products.js 의 분석부(model/build)만 떼어 머리 없는(headless) 모듈로 옮겼다.
   화면 코드는 각 페이지가 렛츠카트 디자인 시스템으로 직접 그린다. */
(function (root) {
  var day = function (d) { return Math.round(new Date(d + 'T00:00:00Z').getTime() / 864e5); };
  var iso = function (n) { return new Date(n * 864e5).toISOString().slice(0, 10); };

  var SRCURL = {
    '쿠팡': function (q) { return 'https://www.coupang.com/np/search?q=' + q; },
    '네이버': function (q) { return 'https://search.shopping.naver.com/search/all?query=' + q; },
    '다나와': function (q) { return 'https://search.danawa.com/dsearch.php?query=' + q; },
    '에누리': function (q) { return 'https://www.enuri.com/search.jsp?keyword=' + q; },
    'G마켓': function (q) { return 'https://www.gmarket.co.kr/n/search?keyword=' + q; },
    '11번가': function (q) { return 'https://search.11st.co.kr/Search.tmall?kwd=' + q; },
    '옥션': function (q) { return 'https://www.auction.co.kr/n/search?keyword=' + q; },
    'SSG': function (q) { return 'https://www.ssg.com/search.ssg?query=' + q; },
    '컬리': function (q) { return 'https://www.kurly.com/search?sword=' + q; },
    '롯데ON': function (q) { return 'https://www.lotteon.com/search/search/search.ecn?render=search&q=' + q; }
  };
  var srcOf = function (x) { return x.src || String(x.mall || '').replace(/\s*최저$/, ''); };
  var pricesOf = function (it, P) {
    return P[it.key] || P[it.name] ||
      (function (k) { return k ? P[k] : []; })(Object.keys(P).find(function (k) { return it.name.indexOf(k) >= 0 || k.indexOf(it.name) >= 0; })) || [];
  };

  /* 4단 판정의 표기 — 색은 디자인 시스템 토큰 이름으로 돌려준다. */
  var KINDS = {
    buy: { label: '지금 사세요', cls: 'act-buy', tone: 'green' },
    soon: { label: '곧 떨어져요', cls: 'act-soon', tone: 'blue' },
    due: { label: '살 때 됐어요', cls: 'act-due', tone: 'red' },
    wait: { label: '기다리세요', cls: 'act-wait', tone: 'amber' },
    ok: { label: '보통 가격', cls: 'act-ok', tone: 'grey' }
  };
  function kindMeta(v) {
    var m = KINDS[v.k] || KINDS.ok;
    var t = v.t || m.label;
    if (v.k === 'soon' && !/^곧 떨어져요/.test(t)) t = '곧 떨어져요' + (/D-\d+/.test(t) ? ' ' + t.match(/D-\d+/)[0] : '');
    if (v.k === 'ok' && /가격 모으는 중/.test(t)) t = '가격 모으는 중';
    return { k: v.k || 'ok', label: t, cls: m.cls, tone: m.tone };
  }

  /** 한 제품의 판단: 지금 사세요 / 곧 떨어져요 D-n / 기다리세요 / 살 때 됐어요 */
  function model(it, P, today, plat) {
    var p = pricesOf(it, P).filter(function (x) { return x.price; });
    if (plat) p = p.filter(function (x) { return srcOf(x) === plat; });
    var byDay = {};
    p.forEach(function (x) { var d = x.date; if (!byDay[d] || x.price < byDay[d].price) byDay[d] = x; });
    var series = Object.keys(byDay).sort().map(function (d) { return { date: d, price: byDay[d].price, src: srcOf(byDay[d]) }; })
      .filter(function (x) { return day(today) - day(x.date) <= 120; });
    var last = p.reduce(function (m, x) { return x.date > m ? x.date : m; }, '');
    var cur = {};
    p.filter(function (x) { return day(last) - day(x.date) <= 3; })
      .forEach(function (x) {
        var s = srcOf(x);
        if (!cur[s] || x.date > cur[s].date || (x.date === cur[s].date && x.price < cur[s].price)) cur[s] = x;
      });
    var q = encodeURIComponent(String(it.name).replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').trim().split(/\s+/).slice(0, 5).join(' '));
    var sources = Object.values(cur).map(function (x) {
      var s = srcOf(x);
      return {
        src: s, price: x.price, date: x.date, title: x.title,
        url: x.url || (SRCURL[s] || SRCURL['네이버'])(q),
        matchScore: x.matchScore, matchLevel: x.matchLevel || 'query'
      };
    }).sort(function (a, b) { return a.price - b.price; });
    var img = it.img || (p.slice().reverse().find(function (x) { return x.img; }) || {}).img || null;
    var mine = it.prices || [], myLast = mine.length ? mine[mine.length - 1] : null;
    var ya = mine.filter(function (x) { return Math.abs(day(today) - day(x.date) - 365) <= 60; }).slice(-1)[0] || null;
    var now = sources[0] || null;
    var ps = series.slice(-30).map(function (x) { return x.price; });
    var avg = ps.length ? ps.reduce(function (a, b) { return a + b; }, 0) / ps.length : null;
    var min = ps.length ? Math.min.apply(null, ps) : null;
    // 반복되는 할인: 평균보다 3% 넘게 싼 날들의 시작점 간격 → 다음 할인 예상일
    var nextDip = null;
    if (series.length >= 14 && avg) {
      var st = [];
      series.forEach(function (x, i) {
        var low = x.price <= avg * 0.97, prevLow = i && series[i - 1].price <= avg * 0.97;
        if (low && !prevLow) st.push(day(x.date));
      });
      if (st.length >= 2) {
        var gs = st.slice(1).map(function (v, i) { return v - st[i]; });
        var g = Math.round(gs.reduce(function (a, b) { return a + b; }, 0) / gs.length);
        var n = st[st.length - 1] + g;
        while (n <= day(today)) n += g;
        if (g >= 4) nextDip = { date: iso(n), d: n - day(today), gap: g };
      }
    }
    var ref = myLast ? myLast.price : null;
    var vsMine = now && ref ? Math.round((now.price - ref) / ref * 100) : null;
    var vsYear = now && ya ? Math.round((now.price - ya.price) / ya.price * 100) : null;
    var v, matchReady = true;
    if (now) {
      var days = series.length, enough = days >= 7, rr = ref ? now.price / ref : 1, refOk = ref && rr > 0.4 && rr < 2.5;
      matchReady = now.matchLevel !== 'low';
      if (!matchReady) v = { k: 'ok', t: '상품 확인 필요' };
      else if ((enough && now.price <= min * 1.02 && (!avg || now.price < avg * 0.99)) || (refOk && now.price <= ref * 0.93)) v = { k: 'buy', t: '지금 사세요' };
      else if (enough && nextDip && nextDip.d <= 21) v = { k: 'soon', t: '곧 떨어져요 D-' + nextDip.d };
      else if ((enough && avg && now.price > avg * 1.03) || (refOk && now.price >= ref * 1.1 && it.daysLeft > 7)) v = { k: 'wait', t: '기다리세요' };
      else if (!enough && !refOk) v = { k: 'ok', t: '가격 모으는 중 ' + days + '/7일' };
      // 값이 특별히 싼 게 아니면 '지금 사세요'가 아니라 구매 주기 기준 '살 때 됐어요'로 둔다.
      else v = (it.count >= 2 && it.daysLeft <= 7) ? { k: 'due', t: '살 때 됐어요' } : { k: 'ok', t: '보통 가격' };
      v.basis = !matchReady ? '검색 결과가 유사 상품일 수 있어요' : (enough ? '최근 ' + days + '일 기준' : (refOk ? '내 지난 가격 기준' : ''));
    } else {
      v = (it.count >= 2 && it.daysLeft <= 7) ? { k: 'due', t: '살 때 됐어요' }
        : (it.count >= 2 && it.daysLeft < 9999) ? { k: 'ok', t: 'D-' + it.daysLeft + ' 후 필요' }
        : { k: 'ok', t: '가격 모으는 중' };
    }
    // 구매 주기가 이미 왔는데 지금 값이 평소보다 비싸지 않으면 '살 때 됐어요'로 확정한다.
    if (it.count >= 2 && it.daysLeft <= 0 && (v.k === 'ok' || v.k === 'wait') && !(now && avg && now.price > avg * 1.03)) {
      v = { k: 'due', t: '살 때 됐어요', basis: '구매 주기 ' + Math.max(0, -it.daysLeft) + '일 경과' };
    }
    var urg = it.count >= 2 ? Math.max(0, 30 - Math.max(0, it.daysLeft)) : 0;
    var score = ({ buy: 100, soon: 70, due: 60, wait: 40, ok: 10 })[v.k] + urg + Math.min(20, it.count) + (vsMine != null && vsMine < 0 ? -vsMine : 0);
    var won = function (n) { return n.toLocaleString('ko-KR') + '원'; };
    var say = '';
    if (now) {
      say = !matchReady ? now.src + ' 검색 결과가 정확히 같은 구성인지 확인한 뒤 비교해 주세요.'
        : v.k === 'buy' ? now.src + ' ' + won(now.price) + ' — ' + (ref ? (now.price <= ref ? '지난번보다 ' + won(ref - now.price) + ' 싸요' : '최근 ' + series.length + '일 중 가장 싼 편이에요') : '최근 최저가 근처예요') + '.'
        : v.k === 'soon' ? nextDip.gap + '일마다 값이 내려가요. ' + (+nextDip.date.slice(5, 7)) + '월 ' + (+nextDip.date.slice(8)) + '일쯤 기다려 보세요.'
        : v.k === 'wait' ? '지금은 최근 평균(' + won(Math.round(avg)) + ')보다 비싸요.'
        : v.k === 'due' ? '구매 주기가 지났어요. 값은 평소 수준이에요.'
        : '평소 가격이에요.';
    } else {
      say = it.count >= 2 ? '평균 ' + it.avgGap + '일마다 사셨어요. 현재가는 매일 모아요.' : '현재가는 매일 모아요.';
    }
    if (it.count >= 2 && it.daysLeft <= 7 && v.k !== 'wait') say += it.daysLeft < 0 ? ' 다시 살 때가 지났어요.' : ' 곧 다시 살 때예요.';
    return {
      name: it.name, key: it.key, count: it.count, avgGap: it.avgGap, daysLeft: it.daysLeft,
      prices: it.prices || [],
      img: img, sources: sources, now: now, series: series, avg: avg && Math.round(avg), min: min,
      myLast: myLast, yearAgo: ya, vsMine: vsMine, vsYear: vsYear, nextDip: nextDip,
      verdict: v, score: score, say: say
    };
  }

  function build(d, opt) {
    var L = root.LetsBuy, I = root.LetsBuyInsights;
    opt = opt || {};
    var all = L.analyze(d.orders, d.today, d.aliases, { all: true }).filter(function (it) { return !(opt.ignored && opt.ignored[it.key]); });
    var A = I ? I.insights(d.orders, { today: d.today, cats: opt.cats || {}, aliases: d.aliases, prices: d.prices }) : null;
    return all.map(function (it) {
      var m = model(it, d.prices || {}, d.today, d.plat);
      var c = A && A.catOfKey[it.key];
      var profile = (c && c.profile) || L.itemProfile(it.name);
      var cat = c ? c.main : '기타', sub = c ? c.sub : '';
      // 17개 카테고리 소모품 사전(DICT)이 '반복 구매하는 생활 품목'이라고 본 것은 추천 대상으로 올린다.
      // 실물·소모 성격이 확인된 경우에만(내구재·수집품·디지털·정산은 그대로 제외).
      var RECURRING = ['식품', '영양제', '생활용품', '뷰티', '육아', '반려동물', '문구·완구'];
      var explicitDurable = !!profile.category && (profile.behavior === 'durable' || profile.behavior === 'collectible');
      if (!profile.recommend && profile.entity === 'physical' && !explicitDurable && RECURRING.indexOf(cat) >= 0) {
        profile = Object.assign({}, profile, {
          recommend: true, behavior: 'consumable', confidence: Math.max(profile.confidence || 0, 0.8),
          category: profile.category || cat, sub: profile.sub || sub,
          reason: (profile.reason || '') + ' · 분류 사전에서 반복 소비 품목으로 확인'
        });
      }
      return Object.assign(m, { cat: cat, sub: sub, profile: profile });
    }).sort(function (a, b) { return b.score - a.score; });
  }

  /* ── 렛츠카트 붙임: 구매 이력(날짜·가격)만 있는 데이터를 엔진 입력으로 바꾼다 ── */
  var dayDiff = function (from, to) { return day(from) - day(to); };

  function unitOf(name, price, qty) {
    var I = root.LetsCartInsights || root.LetsBuyInsights;
    if (!I || !I.unitPrice || !price) return null;
    return I.unitPrice(name, price, qty || 1);
  }

  /** 내가 산 규격보다 지금 등록된 규격이 작으면 슈링크플레이션 신호로 돌려준다.
      묶음 수(2개·4개)가 다르면 같은 상품 비교가 아니므로 판단하지 않는다. */
  function shrinkOf(mineName, nowTitle) {
    var I = root.LetsCartInsights || root.LetsBuyInsights;
    if (!I || !I.sizeOf || !nowTitle) return null;
    // '신라면 120g x 10개 + 짜파게티 140g x 10개'처럼 여러 상품이 한 이름에 있으면 비교하지 않는다.
    var sizes = String(nowTitle).match(/\d+(?:\.\d+)?\s*(?:kg|g|mg|ml|리터|l)\b/gi) || [];
    if (new Set(sizes.map(function (x) { return x.replace(/\s+/g, '').toLowerCase(); })).size > 1) return null;
    var a = I.sizeOf(mineName), b = I.sizeOf(nowTitle);
    if (!a || !b || a.unit !== b.unit) return null;
    if ((a.cnt || 1) !== (b.cnt || 1)) return null;
    if (!(b.amt < a.amt * 0.98)) return null;
    return { pct: Math.round((1 - b.amt / a.amt) * 100), before: a, after: b };
  }

  /**
   * 공개 카탈로그·개인 허브의 한 항목을 판정한다.
   * item = { key, name, mine:[{date,price,mall}], now:{date,price,src}, count, cycleDays, nextDate|daysLeft, img }
   */
  function judge(item, today, opt) {
    opt = opt || {};
    var P = {};
    P[item.key] = [];
    var mineIn = (item.mine || []).slice();
    // 기준가를 직접 줄 때(예: 서버의 평균 구매가)는 마지막 구매가처럼 다룬다.
    if (item.ref && item.ref.price) mineIn.push({ date: item.last || today, price: item.ref.price, mall: item.ref.label || '기준' });
    (mineIn).forEach(function (o) {
      if (o.price) P[item.key].push({ date: o.date, price: o.price, src: o.mall || '구매', mall: o.mall || '구매' });
    });
    if (item.now && item.now.price) {
      P[item.key].push({ date: item.now.date || today, price: item.now.price, src: item.now.src || '다나와', title: item.now.title, matchLevel: opt.matchLevel });
    }
    var daysLeft = item.daysLeft;
    if (daysLeft == null && item.nextDate) daysLeft = dayDiff(item.nextDate, today);
    var it = {
      key: item.key, name: item.name, count: item.count || (item.mine || []).length,
      avgGap: item.cycleDays ? Math.round(item.cycleDays) : 0,
      daysLeft: daysLeft == null ? 9999 : daysLeft,
      prices: mineIn.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }),
      img: item.img
    };
    var r = model(it, P, today, opt.plat);
    r.unit = item.now && item.now.price ? unitOf(item.name, item.now.price, 1) : (r.myLast ? unitOf(item.name, r.myLast.price, 1) : null);
    r.shrink = shrinkOf(item.name, item.now && item.now.title);
    r.meta = kindMeta(r.verdict);
    r.refLabel = item.ref && item.ref.label || null;
    return r;
  }

  /** 공개 카탈로그(data/catalog.json) 상품 하나 → 판정 */
  function judgeCatalog(p, today) {
    var reb = p.rebuy || {};
    var hist = (p.history || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var mine = hist.filter(function (h) { return h.source !== 'danawa' && h.price; })
      .map(function (h) { return { date: h.date, price: h.price, mall: h.mall || '구매' }; });
    var cur = p.price || (p.tracker && p.tracker.minPrice) || null;
    if (!cur && !mine.length) return null;
    var item = {
      key: p.id, name: p.danawaName || p.name, mine: mine,
      now: cur ? { date: today, price: cur, src: '다나와', title: p.danawaName || p.name } : null,
      count: reb.count || 0, cycleDays: reb.cycle || null,
      nextDate: reb.next || null, img: p.media,
      target: reb.target || null
    };
    var r = judge(item, today);
    r.target = item.target;
    r.group = p.group;
    r.catalogId = p.id;
    return r;
  }

  /*
   * 화면 집계 — 판정 분포와 '이번 달 살 때 온 품목'을 한 곳에서 센다.
   * 히어로 머리 숫자·레인·이번 달 보드·살 때 판정 패널이 모두 이 결과만 쓰므로
   * 서로 다른 조합을 더해 숫자가 어긋나는 일이 없다.
   *   rows  서버 재구매 행([{ daysLeft, ... }])
   *   judge (row) => { verdict: { k } } | null  — 판정이 없으면 '보통 가격(ok)'으로 센다
   *   opt.winDays  '이번 달' 창(기본 21일). 다음 예상일이 없어 daysLeft가 null인 품목은 창에 넣는다.
   * 반환: { total, by{buy,soon,due,wait,ok}, month{buy,due,wait}, monthTotal, unknown, outside, winDays }
   */
  function tally(rows, judgeFn, opt) {
    opt = opt || {};
    var winDays = opt.winDays == null ? 21 : opt.winDays;
    var by = { buy: 0, soon: 0, due: 0, wait: 0, ok: 0 };
    var month = { buy: 0, due: 0, wait: 0 };
    var total = 0, unknown = 0, monthTotal = 0;
    (rows || []).forEach(function (r) {
      var a = null;
      try { a = judgeFn ? judgeFn(r) : null; } catch (e) { a = null; }
      var k = a && a.verdict && a.verdict.k;
      if (!Object.prototype.hasOwnProperty.call(by, k)) k = 'ok';
      by[k]++;
      total++;
      var d = r.daysLeft;
      if (d == null) unknown++;
      if ((d == null || d <= winDays) && Object.prototype.hasOwnProperty.call(month, k)) {
        month[k]++;
        monthTotal++;
      }
    });
    return { total: total, by: by, month: month, monthTotal: monthTotal,
      unknown: unknown, outside: total - monthTotal, winDays: winDays };
  }

  var api = {
    SRCURL: SRCURL, KINDS: KINDS, kindMeta: kindMeta, model: model, build: build,
    pricesOf: pricesOf, srcOf: srcOf, judge: judge, judgeCatalog: judgeCatalog,
    unitOf: unitOf, shrinkOf: shrinkOf, tally: tally
  };
  if (typeof module !== 'undefined') module.exports = api;
  root.LetsCartAction = api;
  if (!root.LetsBuyProducts) root.LetsBuyProducts = { model: model, build: build, pricesOf: pricesOf };
})(typeof window !== 'undefined' ? window : globalThis);
