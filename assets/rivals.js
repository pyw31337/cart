/* 렛츠카트 — 라이벌·유사 인기 상품 비교 컴포넌트 (Ver 1.0)
   data/rivals.json(다나와 실측) + 내 구매 기록(배열)을 결합해
   단위가격·스펙·가격 추이를 비교한다. 공개 화면과 개인 화면이 같은 코드를 쓴다.
   - 개인정보는 인자로 받은 주문 배열 안에서만 쓰고 어디에도 저장하지 않는다.
   - 관측이 1회뿐인 값은 '관측 시작'으로 표시하고 선을 그리지 않는다. */
(function (root) {
  "use strict";
  var LC = root.LC || {};
  var DATA = null;
  var BASE = (typeof location !== "undefined" && /\/my\/|\/local\//.test(location.pathname)) ? "../" : "";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(n) { return n == null || n === "" ? "-" : Number(n).toLocaleString("ko-KR"); }
  function won(n) { return n == null ? "-" : num(n) + "원"; }
  function compact(n) {
    if (n == null) return "-";
    if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, "") + "억";
    if (n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "만";
    return num(n);
  }
  function date(s) { return s ? String(s).slice(0, 10).replace(/-/g, ".") : "-"; }
  function pct(v) { return (v > 0 ? "+" : "") + Math.round(v) + "%"; }
  function days(a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); }

  /* ------------------------------------------------ 단위(용량·수량) 파서 */
  var SIZE = /(\d+(?:\.\d+)?)\s*(kg|g|mg|ml|l)(?![a-z])/i;
  var INNER = /\(\s*(\d+(?:\.\d+)?)\s*(g|ml)\s*[x×]\s*(\d+)\s*(?:p|개|입)\s*\)/i;
  function unitOf(name) {
    var n = String(name || "").replace(/<[^>]+>/g, "").replace(/,/g, " ");
    n = n.replace(/[xX×]/g, " x ");
    if (!n) return null;
    if (/롤/.test(n)) {
      var rolls = n.match(/(\d{1,3})\s*롤/);
      var packs = n.match(/\((\d{1,2})\s*팩\)/);
      var cnt = (rolls ? +rolls[1] : 1);
      if (!rolls) {
        var ip = n.match(/(\d{1,3})\s*개입/);
        if (ip) cnt = +ip[1];
      }
      cnt *= (packs ? +packs[1] : 1);
      return { kind: "roll", qty: cnt, per: 1, label: "1롤당", text: cnt + "롤" };
    }
    if (/물티슈/.test(n) && /매/.test(n)) {
      var sh = n.match(/(\d{1,4})\s*매/);
      var pk = n.match(/\((\d{1,3})\s*팩\)/);
      var c2 = (sh ? +sh[1] : 1) * (pk ? +pk[1] : 1);
      return { kind: "sheet", qty: c2, per: 100, label: "100매당", text: c2 + "매" };
    }
    var m = n.match(SIZE);
    if (m) {
      var amt = parseFloat(m[1]);
      var u = m[2].toLowerCase();
      var kind = "g";
      if (u === "kg") amt *= 1000;
      else if (u === "mg") amt /= 1000;
      else if (u === "l") { amt *= 1000; kind = "ml"; }
      else if (u === "ml") kind = "ml";
      var packs2 = 1;
      var inn = n.match(INNER);
      if (inn) {
        var tot = parseFloat(inn[1]) * parseInt(inn[3], 10);
        if (Math.abs(tot - amt) / Math.max(amt, 1) > 0.12) packs2 = parseInt(inn[3], 10);
      } else {
        var tail = n.slice(m.index + m[0].length, m.index + m[0].length + 30);
        var pm = tail.match(/\(\s*(\d{1,3})\s*(?:개|팩|봉|병|캔|입)\s*\)/) ||
                 tail.match(/[xX×]\s*(\d{1,3})\s*(?:개|팩|봉|병|캔|입|p)\b/i) ||
                 tail.match(/(\d{1,3})\s*(?:개입|개|입|팩|봉|병|캔)(?![가-힣])/);
        if (pm) packs2 = parseInt(pm[1], 10);
      }
      var total = amt * packs2;
      return { kind: kind, qty: total, per: 100, label: "100" + kind + "당",
        text: (total >= 10 ? Math.round(total) : Math.round(total * 10) / 10) + kind };
    }
    var pc = n.match(/(\d{1,3})\s*(?:개입|개|입|정|캡슐)(?![가-힣])/g) || n.match(/(\d{1,3})\s*P(?![A-Za-z])/gi);
    if (pc) {
      var c3 = 1;
      pc.slice(0, 3).forEach(function (x) { c3 *= parseInt(x, 10); });
      return { kind: "ea", qty: c3, per: 1, label: "1개당", text: c3 + "개" };
    }
    return null;
  }
  function unitPriceOf(name, price, qty) {
    var u = unitOf(name);
    if (!u || !price) return null;
    return { value: Math.round(price / u.qty * u.per), label: u.label, unit: u };
  }

  /* ------------------------------------------------ 내 구매 기록 집계 */
  function matches(order, group) {
    var keys = group.match || [];
    var n = String(order.name || "");
    var ex = group.exclude || [];
    for (var j = 0; j < ex.length; j++) if (n.indexOf(ex[j]) >= 0) return false;
    for (var i = 0; i < keys.length; i++) if (n.indexOf(keys[i]) >= 0) return true;
    return false;
  }
  function mean(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; }
  function median(a) {
    if (!a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function myStats(orders, group) {
    var rows = (orders || []).filter(function (o) { return o && o.price > 0 && matches(o, group); });
    rows.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var points = [], units = [], prices = [], dates = [];
    rows.forEach(function (o) {
      var p = Math.round(o.price / (o.qty || 1));
      prices.push(p);
      dates.push(o.date);
      var u = unitPriceOf(o.name, p);
      if (u) units.push(u.value);
      points.push({ d: o.date, v: u ? u.value : p, p: p, n: o.name, m: o.mall });
    });
    var gaps = [];
    for (var i = 1; i < dates.length; i++) {
      var g = days(dates[i - 1], dates[i]);
      if (g > 0) gaps.push(g);
    }
    var cycle = gaps.length ? Math.round(median(gaps)) : null;
    var last = dates.length ? dates[dates.length - 1] : null;
    var next = last && cycle ? new Date(new Date(last).getTime() + cycle * 864e5).toISOString().slice(0, 10) : null;
    return {
      buys: rows.length,
      rows: rows,
      points: points,
      avg: prices.length ? Math.round(mean(prices)) : null,
      avgUnit: units.length ? Math.round(mean(units)) : null,
      min: prices.length ? Math.min.apply(null, prices) : null,
      max: prices.length ? Math.max.apply(null, prices) : null,
      spend: rows.reduce(function (s, o) { return s + o.price; }, 0),
      cycle: cycle, last: last, next: next,
      name: rows.length ? rows[rows.length - 1].name : null,
      unitLabel: group.unitLabel
    };
  }

  /* ------------------------------------------------ 비교 계산 */
  function compare(group, my) {
    var base = group.products[0];
    var rivals = group.products.slice(1);
    var mineUnit = my && my.avgUnit ? my.avgUnit : null;
    var ref = mineUnit || base.unitPrice;
    var rows = [{
      role: "mine", name: my && my.name ? my.name : base.name, p: my && my.avg ? my.avg : base.price,
      up: mineUnit || base.unitPrice, prod: base, rating: base.rating, reviews: base.reviews
    }].concat(rivals.map(function (p) {
      return { role: "rival", name: p.name, p: p.price, up: p.unitPrice, prod: p, rating: p.rating, reviews: p.reviews };
    }));
    var cheapest = rows.slice().sort(function (a, b) { return (a.up || 1e12) - (b.up || 1e12); })[0];
    var best = rivals.slice().sort(function (a, b) { return (a.unitPrice || 1e12) - (b.unitPrice || 1e12); })[0];
    var diff = ref && best && best.unitPrice ? Math.round((best.unitPrice - ref) / ref * 1000) / 10 : null;
    var mineSave = (ref && best && best.unitPrice && best.unitPrice > ref)
      ? Math.round((best.unitPrice - ref) / best.unitPrice * 1000) / 10 : null;
    return { base: base, rivals: rivals, rows: rows, cheapest: cheapest, best: best, mineUnit: mineUnit,
      ref: ref, diff: diff, mineSave: mineSave, hasMine: !!(my && my.buys) };
  }

  /* ------------------------------------------------ SVG 선 그래프 */
  var W = 600, H = 190, PAD = { l: 46, r: 12, t: 14, b: 24 };
  function chart(series, opts) {
    opts = opts || {};
    var all = [];
    series.forEach(function (s) { s.points.forEach(function (p) { all.push(p); }); });
    if (!all.length) return '<div class="note">가격 기록이 아직 없습니다.</div>';
    var vals = all.map(function (p) { return p.v; });
    var t0 = all[0].d, t1 = all[all.length - 1].d;
    all.forEach(function (p) { if (p.d < t0) t0 = p.d; if (p.d > t1) t1 = p.d; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var span = Math.max(hi - lo, Math.max(hi * 0.06, 1));
    lo = Math.max(0, lo - span * 0.18); hi = hi + span * 0.18;
    var tSpan = Math.max(days(t0, t1), 1);
    function X(d) { return PAD.l + (days(t0, d) / tSpan) * (W - PAD.l - PAD.r); }
    function Y(v) { return PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b); }
    var g = [];
    for (var i = 0; i <= 3; i++) {
      var v = lo + (hi - lo) * (i / 3), y = Y(v);
      g.push('<line x1="' + PAD.l + '" x2="' + (W - PAD.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) +
        '" stroke="#E3E6DB" stroke-width="1"/>');
      g.push('<text x="' + (PAD.l - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" font-size="9.5" fill="#7C827A" font-weight="700">' +
        compact(Math.round(v)) + '원</text>');
    }
    var paths = series.map(function (s) {
      var pts = s.points.slice().sort(function (a, b) { return a.d < b.d ? -1 : 1; });
      if (!pts.length) return "";
      var line = pts.map(function (p, idx) { return (idx ? "L" : "M") + X(p.d).toFixed(1) + "," + Y(p.v).toFixed(1); }).join(" ");
      var out = "";
      if (pts.length > 1) {
        out += '<path d="' + line + '" fill="none" stroke="' + s.color + '" stroke-width="' + (s.width || 2.4) +
          '" stroke-linecap="round" stroke-linejoin="round"' + (s.dash ? ' stroke-dasharray="' + s.dash + '"' : "") + '/>';
      }
      if (pts.length <= 22) {
        out += pts.map(function (p) {
          return '<circle cx="' + X(p.d).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="' + (s.dot || 2.6) +
            '" fill="#fff" stroke="' + s.color + '" stroke-width="1.8"/>';
        }).join("");
      }
      var lp = pts[pts.length - 1];
      out += '<circle cx="' + X(lp.d).toFixed(1) + '" cy="' + Y(lp.v).toFixed(1) + '" r="4" fill="' + s.color + '"/>';
      return out;
    }).join("");
    var labs = '<text x="' + PAD.l + '" y="' + (H - 6) + '" font-size="10" fill="#7C827A" font-weight="700">' + date(t0).slice(2) + '</text>' +
      '<text x="' + (W - PAD.r) + '" y="' + (H - 6) + '" text-anchor="end" font-size="10" fill="#7C827A" font-weight="700">' + date(t1).slice(2) + '</text>';
    return '<div class="rv-chart"><div class="rv-chart-legend">' + series.map(function (s) {
      return '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>';
    }).join("") + '</div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.label || "가격 추이 비교") + '">' +
      g.join("") + paths + labs + '</svg>' +
      (opts.note ? '<div class="rv-obs">' + opts.note + '</div>' : "") + '</div>';
  }

  /* 가격 추이의 비정상 급락·급등점(다른 구성으로 집계된 값)은 선을 왜곡해 제외한다. */
  function saneTrend(points) {
    if (!points || points.length < 4) return points || [];
    var s = points.map(function (x) { return x.p; }).sort(function (a, b) { return a - b; });
    var med = s[Math.floor(s.length / 2)];
    if (!med) return points;
    return points.filter(function (x) { return x.p >= med * 0.5 && x.p <= med * 2; });
  }

  function trendSeries(group, my, rangeDays) {
    var cut = new Date(Date.now() - (rangeDays || 180) * 864e5).toISOString().slice(0, 10);
    var base = group.products[0];
    var colors = ["#111315", "#9AA294", "#C9A227"];
    var series = [];
    var basePts = saneTrend((base.trend || []).filter(function (p) { return p.d >= cut; }))
      .map(function (p) {
        var u = base.unit ? { qty: base.unit.qty, per: base.unit.per } : null;
        return { d: p.d, v: u ? Math.round(p.p / u.qty * u.per) : p.p };
      });
    series.push({ name: "내 상품 · 다나와", color: "#84F000", width: 3, points: basePts });
    group.products.slice(1).forEach(function (p, i) {
      var pts = saneTrend((p.trend || []).filter(function (x) { return x.d >= cut; })).map(function (x) {
        var u = p.unit ? { qty: p.unit.qty, per: p.unit.per } : null;
        return { d: x.d, v: u ? Math.round(x.p / u.qty * u.per) : x.p };
      });
      var lead = p.name.split(" ")[0].replace(/[(),]/g, "");
      series.push({ name: lead + (p.unit ? " · " + p.unit.text : ""), color: colors[i % 3], width: 1.8, dash: "4 4", dot: 2.1, points: pts });
    });
    if (my && my.points && my.points.length) {
      series.push({ name: "내가 낸 단위가격", color: "#F0335F", width: 2.4, dot: 3, points: my.points.filter(function (p) { return p.d >= cut; }) });
    }
    return series;
  }

  /* ------------------------------------------------ ⓘ 툴팁·사진 조각 */
  var INFO_SVG = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/>' +
    '<path d="M12 11v5.5M12 7.8v.1"/></svg>';
  function info(text, label) {
    return '<button type="button" class="info" data-tip="' + esc(text) + '" aria-label="' +
      esc(label || "설명 보기") + '" aria-expanded="false" tabindex="0">' + INFO_SVG + '</button>';
  }
  function shortName(p) {
    var b = String((p && p.brand) || "").trim();
    if (b && b !== "제조사 미표기") return b;
    return String((p && p.name) || "").split(" ")[0].slice(0, 10);
  }
  function unitTip(group) {
    return "상품명의 용량·수량을 " + group.unitLabel + "으로 환산했습니다. 내 단위가격은 실제 결제 금액을 같은 방식으로 나눈 값입니다. (다나와 " +
      date(group.observedAt) + " 수집)";
  }
  function saveOf(c) {
    if (c.diff == null) return null;
    return Math.round(Math.abs(c.diff) * 10) / 10;
  }
  function shotHTML(p, name, unit, isMine) {
    return '<figure class="shot' + (isMine ? " mine" : "") + '">' +
      '<span class="shot-tag">' + (isMine ? "내 상품" : "라이벌") + '</span>' +
      (p.image
        ? '<img src="' + BASE + esc(p.image) + '" alt="' + esc(p.brand || name) + '" loading="lazy" width="240" height="240" />'
        : '<span class="thumb-ph"></span>') +
      '<figcaption class="shot-cap"><span class="shot-name">' + esc(name) + '</span>' +
      '<span class="shot-price"><b class="tnum">' + num(unit) + '</b><small>원</small></span></figcaption></figure>';
  }

  /* ------------------------------------------------ 비교 시트 */
  function cardHTML(r, group, c, isMine) {
    var p = r.prod;
    var d = c.ref && r.up ? Math.round((r.up - c.ref) / c.ref * 1000) / 10 : null;
    var cls = d == null ? "flat" : d < -1 ? "down" : d > 1 ? "up" : "flat";
    return '<div class="rv-card' + (isMine ? " mine" : "") + '">' +
      (isMine ? '<span class="rv-tag">' + (c.hasMine ? "내가 사는 것" : "기준 상품") + '</span>' : "") +
      (p.image ? '<img class="rv-card-shot" src="' + BASE + esc(p.image) + '" alt="' + esc(p.brand || r.name) +
        '" loading="lazy" width="240" height="240" />' : '<div class="rv-card-shot"></div>') +
      '<div class="rv-card-body">' +
        '<div class="rv-card-name">' + esc(r.name) + '</div>' +
        '<div class="rv-card-price"><span class="v tnum">' + (isMine && r.p ? num(r.p) : won(p.price)) + '</span>' +
          '<span class="u">' + (isMine && c.hasMine && r.p ? "내 평균가" : "다나와 최저") + '</span></div>' +
        '<div class="rv-card-unit"><b class="tnum">' + (r.up ? num(r.up) + "원" : "-") + '</b><span>' +
          esc(group.unitLabel) + '</span>' +
          (!isMine && d != null ? '<span class="rv-delta ' + cls + '" style="margin-left:auto">' +
            (d === 0 ? "같음" : pct(d)) + '</span>' : "") + '</div>' +
        '<div class="rv-card-meta">' +
          (r.rating ? '<span>★ ' + r.rating + '</span>' : "") +
          (r.reviews ? '<span>리뷰 ' + compact(r.reviews) + '</span>' : "") +
          (p.unit ? '<span>' + esc(p.unit.text) + '</span>' : "") +
          '<a href="' + esc(p.url) + '" target="_blank" rel="noopener">다나와 ↗</a>' +
        '</div>' +
      '</div></div>';
  }

  function compareHTML(group, my, opts) {
    opts = opts || {};
    var c = compare(group, my);
    var base = c.base;
    var best = c.best || group.products[1] || base;
    var myUnit = (my && my.avgUnit) ? my.avgUnit : base.unitPrice;
    var save = saveOf(c);
    var myLine = "";
    if (my && my.buys) {
      myLine = '<div class="rv-hero-mine"><b>내 기록 ' + my.buys + '회</b>' +
        '<span>평균 ' + won(my.avg) + '</span>' +
        '<span>최저 ' + won(my.min) + '</span>' +
        (my.cycle ? '<span>주기 ' + my.cycle + '일</span>' : "") +
        (my.next ? '<span>다음 ' + date(my.next) + '</span>' : "") + '</div>';
    }

    var hero = '<div class="rv-hero">' +
      '<div class="rv-hero-top"><span class="rv-hero-k">' + esc(group.unitLabel) + ' 기준</span>' +
        info(unitTip(group), "단위가격 계산 기준") + '</div>' +
      '<div class="rv-hero-stage">' +
        shotHTML(base, shortName(base), myUnit, true) +
        '<span class="vs-dot">VS</span>' +
        shotHTML(best, shortName(best), best.unitPrice, false) +
      '</div>' +
      '<div class="rv-hero-facts">' +
        '<span><b class="tnum">' + num(myUnit) + '원</b> 내 상품</span>' +
        '<span><b class="tnum">' + num(best.unitPrice) + '원</b> 라이벌 최저</span>' +
        (save == null ? "" : c.diff < 0
          ? '<span class="save">−' + save + '%</span>'
          : c.diff > 0 ? '<span class="save win">내 상품 우세</span>' : '<span class="save win">같음</span>') +
      '</div>' + myLine +
    '</div>';

    var keys = [];
    [c.rows[0]].concat(group.products.slice(1).map(function (p) { return { prod: p }; })).forEach(function (r) {
      (r.prod.spec || []).forEach(function (x) { if (x[0] && keys.indexOf(x[0]) < 0 && keys.length < 4) keys.push(x[0]); });
    });
    var tableRows = [
      ["브랜드", function (r) { return esc(r.prod.brand || "-"); }],
      ["용량·규격", function (r) { return esc(r.prod.unit ? r.prod.unit.text : "-"); }],
      [group.unitLabel, function (r) { return r.up ? "<b class=\"tnum\">" + num(r.up) + "원</b>" : "-"; }],
      ["판매 최저가", function (r) { return won(r.prod.price); }],
      ["평점·리뷰", function (r) { return (r.rating ? "★" + r.rating : "-") + " · " + (r.reviews ? compact(r.reviews) : "-"); }]
    ];
    keys.forEach(function (k) {
      tableRows.push([esc(k), function (r) {
        var hit = (r.prod.spec || []).filter(function (x) { return x[0] === k; })[0];
        return hit ? esc(hit[1]) : "-";
      }]);
    });

    var table = '<div class="section"><div class="section-head"><h3>스펙 · 단위가격</h3>' +
      info("다나와 상품 상세의 스펙을 그대로 옮겼습니다. 값이 없는 항목은 -로 둡니다.", "스펙 출처") +
      '<span class="hint">' + date(group.observedAt) + '</span></div>' +
      '<div style="overflow-x:auto"><table class="rv-table"><thead><tr><th>항목</th>' +
      '<th class="mine">내 상품</th>' + c.rivals.map(function (p, i) {
        return "<th>라이벌 " + String.fromCharCode(65 + i) + "</th>";
      }).join("") + '</tr></thead><tbody>' + tableRows.map(function (row) {
        return "<tr><td>" + row[0] + "</td>" + c.rows.map(function (r, i) {
          return '<td class="' + (i === 0 ? "mine" : "") + '">' + row[1](r) + "</td>";
        }).join("") + "</tr>";
      }).join("") + "</tbody></table></div></div>";

    var range = opts.range || 180;
    var series = trendSeries(group, my, range);
    var rangeChips = [[30, "1개월"], [90, "3개월"], [180, "6개월"], [365, "1년"]].map(function (x) {
      return '<button type="button" data-rv-range="' + x[0] + '" aria-pressed="' + (range === x[0]) + '">' + x[1] + "</button>";
    }).join("");
    var obs = "다나와 주간 최저가 · " + date(group.observedAt) + " 수집";
    var cards = c.rows.map(function (r, i) { return cardHTML(r, group, c, i === 0); }).join("");

    return hero +
      '<div class="section"><div class="section-head"><h3>내 상품 vs 라이벌 ' + c.rivals.length + '종</h3>' +
        '<span class="hint">' + esc(group.short || group.label) + '</span></div>' +
        '<div class="rv-cards">' + cards + '</div></div>' +
      (opts.compact ? "" : table) +
      '<div class="section"><div class="section-head"><h3>가격 추이</h3>' +
        info("다나와 최저가 추이(주간)의 실제 관측값입니다. 내 구매 시점의 실제 결제가는 핑크 점으로 표시합니다. 관측이 1회뿐이면 점만 그리고, 다른 구성 상품으로 집계된 비정상 급락점은 제외합니다.", "가격 추이 기준") +
        '<span class="hint">' + esc(group.unitLabel) + ' 환산</span></div>' +
        '<div class="rv-range" data-rv-ranges>' + rangeChips + '</div>' +
        '<div style="margin-top:8px" data-rv-chart>' + chart(series, { note: obs, label: group.label + " 가격 추이" }) + '</div></div>';
  }

  function bindRanges(box, group, my) {
    box.querySelectorAll("[data-rv-range]").forEach(function (b) {
      b.addEventListener("click", function () {
        var r = +b.dataset.rvRange;
        box.querySelectorAll("[data-rv-range]").forEach(function (x) {
          x.setAttribute("aria-pressed", String(+x.dataset.rvRange === r));
        });
        var holder = box.querySelector("[data-rv-chart]");
        if (holder) holder.innerHTML = chart(trendSeries(group, my, r), {
          note: "다나와 주간 최저가 · " + date(group.observedAt) + " 수집",
          label: group.label + " 가격 추이"
        });
      });
    });
  }

  /* 시트 열기 */
  function open(group, my, opts) {
    opts = opts || {};
    var title = group.label + " 비교";
    LC.sheet({
      title: title,
      subtitle: (my && my.buys ? "내 기록 " + my.buys + "회 반영" : "다나와 공개 가격") + " · 라이벌 " + (group.products.length - 1) + "종",
      render: function (box) {
        box.innerHTML = compareHTML(group, my, opts);
        bindRanges(box, group, my);
      },
      footer: '<a class="btn btn-primary btn-sm" href="' + esc(group.products[0].url) + '" target="_blank" rel="noopener">내 상품 다나와에서 보기 ↗</a>' +
        '<span class="help" style="margin:0 0 0 auto">' + date(group.observedAt) + '</span>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-act="close">닫기</button>' 
    });
  }

  /* 스트립 타일 — 사진 2장 VS 보드 */
  function tile(group, my) {
    var c = compare(group, my);
    var mine = group.products[0];
    var best = c.best || group.products[1] || mine;
    var myUnit = (my && my.avgUnit) ? my.avgUnit : mine.unitPrice;
    var save = saveOf(c);
    return '<button type="button" class="rv-tile" data-rv-open="' + esc(group.id) + '" aria-label="' +
        esc(group.short || group.label) + ' 사진 비교">' +
      '<span class="rv-vs">' +
        '<span class="rv-shot">' + (mine.image ? '<img src="' + BASE + esc(mine.image) + '" alt="" loading="lazy" width="160" height="160" />' : "") +
          '<span class="rv-shot-tag">내</span></span>' +
        '<span class="rv-shot">' + (best.image ? '<img src="' + BASE + esc(best.image) + '" alt="" loading="lazy" width="160" height="160" />' : "") +
          (save != null && c.diff < 0 ? '<b class="rv-drop">−' + save + '%</b>' : "") + '</span>' +
        '<span class="rv-vs-dot">VS</span>' +
      '</span>' +
      '<span class="rv-tile-body">' +
        '<span class="rv-tile-name">' + esc(group.short || group.label) + '</span>' +
        '<span class="rv-tile-price"><b class="tnum' + (c.diff > 0 ? " best" : "") + '">' + num(myUnit) + '</b>' +
          '<b class="tnum' + (c.diff > 0 ? "" : " best") + '">' + num(best.unitPrice) + '</b>' +
          '<i>' + esc(group.unitLabel) + '</i></span>' +
        (my && my.buys ? '<span class="rv-tile-mine">내 기록 ' + my.buys + '회</span>' : "") +
      '</span></button>';
  }

  function stripHTML(groups, orders) {
    var byGroup = groups.map(function (g) { return { g: g, my: myStats(orders, g) }; });
    byGroup.sort(function (a, b) { return (b.my.buys || 0) - (a.my.buys || 0); });
    return '<div class="rv-strip">' + byGroup.map(function (x) { return tile(x.g, x.my); }).join("") + '</div>';
  }

  function bindStrip(container, groups, orders) {
    var byId = {};
    groups.forEach(function (g) { byId[g.id] = g; });
    container.querySelectorAll("[data-rv-open]").forEach(function (b) {
      b.addEventListener("click", function () {
        var g = byId[b.dataset.rvOpen];
        if (g) open(g, myStats(orders, g));
      });
    });
  }

  function load() {
    if (DATA) return Promise.resolve(DATA);
    return fetch(BASE + "data/rivals.json", { headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) { DATA = d; return d; });
  }

  if (typeof module !== "undefined" && module.exports) module.exports = root.LetsCartRivals;
  root.LetsCartRivals = {
    load: load,
    groups: function () { return DATA ? DATA.groups : []; },
    unitOf: unitOf,
    unitPriceOf: unitPriceOf,
    myStats: myStats,
    compare: compare,
    compareHTML: compareHTML,
    chart: chart,
    series: trendSeries,
    bindRanges: bindRanges,
    open: open,
    tile: tile,
    stripHTML: stripHTML,
    bindStrip: bindStrip,
    won: won, num: num, compact: compact, date: date, esc: esc
  };
})(typeof window !== "undefined" ? window : globalThis);
