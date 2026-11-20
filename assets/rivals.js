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
    if (!n) return null;
    if (/롤/.test(n)) {
      var rolls = n.match(/(\d{1,3})\s*롤/);
      var packs = n.match(/\((\d{1,2})\s*팩\)/);
      var cnt = (rolls ? +rolls[1] : 1) * (packs ? +packs[1] : 1);
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
                 tail.match(/[x×]\s*(\d{1,3})\s*(?:개|팩|봉|병|캔|입|p)\b/) ||
                 tail.match(/(\d{1,3})\s*(?:개입|개|입|팩|봉|병|캔)(?![가-힣])/);
        if (pm) packs2 = parseInt(pm[1], 10);
      }
      var total = amt * packs2;
      return { kind: kind, qty: total, per: 100, label: "100" + kind + "당",
        text: (total >= 10 ? Math.round(total) : Math.round(total * 10) / 10) + kind };
    }
    var pc = n.match(/(\d{1,3})\s*(?:개입|개|입|정|캡슐)(?![가-힣])/g);
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
      g.push('<text x="' + (PAD.l - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" font-size="10" fill="#7C827A" font-weight="700">' +
        compact(Math.round(v)) + '</text>');
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

  function trendSeries(group, my, rangeDays) {
    var cut = new Date(Date.now() - (rangeDays || 180) * 864e5).toISOString().slice(0, 10);
    var base = group.products[0];
    var colors = ["#111315", "#9AA294", "#C9A227"];
    var series = [];
    var basePts = (base.trend || []).filter(function (p) { return p.d >= cut; })
      .map(function (p) {
        var u = base.unit ? { qty: base.unit.qty, per: base.unit.per } : null;
        return { d: p.d, v: u ? Math.round(p.p / u.qty * u.per) : p.p };
      });
    series.push({ name: "내 상품 · 다나와", color: "#84F000", width: 3, points: basePts });
    group.products.slice(1).forEach(function (p, i) {
      var pts = (p.trend || []).filter(function (x) { return x.d >= cut; }).map(function (x) {
        var u = p.unit ? { qty: p.unit.qty, per: p.unit.per } : null;
        return { d: x.d, v: u ? Math.round(x.p / u.qty * u.per) : x.p };
      });
      series.push({ name: (p.brand || "라이벌") + " · " + p.name.split(" ").slice(-1)[0], color: colors[i % 3], width: 1.8, dash: "4 4", dot: 2.1, points: pts });
    });
    if (my && my.points && my.points.length) {
      series.push({ name: "내가 낸 단위가격", color: "#F0335F", width: 2.4, dot: 3, points: my.points.filter(function (p) { return p.d >= cut; }) });
    }
    return series;
  }

  /* ------------------------------------------------ HTML 조각 */
  function specsOf(p, n) {
    return (p.spec || []).filter(function (x) { return x[1]; }).slice(0, n || 3)
      .map(function (x) { return [x[0], x[1]]; });
  }
  function cardHTML(r, group, c, isMine) {
    var p = r.prod;
    var d = c.ref && r.up ? Math.round((r.up - c.ref) / c.ref * 1000) / 10 : null;
    var cls = d == null ? "flat" : d < -1 ? "down" : d > 1 ? "up" : "flat";
    var specs = specsOf(p, 3);
    return '<div class="rv-card' + (isMine ? " mine" : "") + '">' +
      (isMine ? '<span class="rv-tag">' + (c.hasMine ? "내가 사는 것" : "기준 상품") + '</span>' : "") +
      '<div class="rv-card-head">' +
        (p.image ? '<img class="rv-card-img" src="' + BASE + esc(p.image) + '" alt="" loading="lazy" width="44" height="44" />' : '<span class="rv-card-img"></span>') +
        '<div style="min-width:0"><div class="rv-card-name">' + esc(r.name) + '</div>' +
        '<div class="rv-card-brand">' + esc(p.brand || "제조사 미표기") + ' · ' + esc(group.label) + '</div></div>' +
      '</div>' +
      '<div class="rv-card-price"><span class="v tnum">' + (isMine && r.p ? num(r.p) + "원" : won(p.price)) + '</span>' +
        '<span class="u">' + (isMine && r.up ? "내 평균가" : "다나와 최저가") + '</span>' +
        (!isMine && d != null ? '<span class="rv-delta ' + cls + '">' + (d === 0 ? "같음" : pct(d)) + '</span>' : "") +
      '</div>' +
      '<div class="rv-card-price" style="margin-top:2px"><span class="v tnum" style="font-size:15px">' +
        (r.up ? num(r.up) + "원" : "-") + '</span><span class="u">' + esc(group.unitLabel) + '</span></div>' +
      '<div class="rv-card-meta">' +
        (r.rating ? '<span class="badge">★ ' + r.rating + '</span>' : '<span class="badge">평점 없음</span>') +
        (r.reviews ? '<span class="badge">리뷰 ' + compact(r.reviews) + '</span>' : "") +
        (p.unit ? '<span class="badge">' + esc(p.unit.text) + '</span>' : "") +
        (p.offers ? '<span class="badge">' + num(p.offers) + '곳</span>' : "") +
      '</div>' +
      (specs.length ? '<ul class="rv-card-spec">' + specs.map(function (s) {
        return "<li>" + (s[0] ? "<b>" + esc(s[0]) + "</b> " : "") + esc(s[1]) + "</li>";
      }).join("") + '</ul>' : "") +
      '<div class="rv-card-meta" style="margin-top:8px"><a class="badge" href="' + esc(p.url) + '" target="_blank" rel="noopener">다나와에서 보기 ↗</a></div>' +
    '</div>';
  }

  function compareHTML(group, my, opts) {
    opts = opts || {};
    var c = compare(group, my);
    var base = c.base;
    var diffText = "";
    if (c.diff != null && c.best) {
      diffText = c.diff < 0
        ? "라이벌 <b>" + esc((c.best.brand || c.best.name).slice(0, 14)) + "</b>가 " + esc(group.unitLabel) + " <b>" + Math.abs(c.diff) + "% 저렴</b>"
        : c.diff > 0
          ? "내 상품이 라이벌보다 " + esc(group.unitLabel) + " <b>" + c.mineSave + "% 저렴</b>"
          : "라이벌과 단위가격이 같음";
    }
    var myLine = my && my.buys
      ? "내 기록 " + my.buys + "회 · 평균 " + won(my.avg) + " · 최저 " + won(my.min) + " · 최고 " + won(my.max) +
        (my.cycle ? " · 주기 " + my.cycle + "일" : "") + (my.next ? " · 다음 " + date(my.next) : "")
      : "내 구매 기록이 이 품목에는 아직 없습니다. 아래는 다나와 공개 가격 기준입니다.";

    var tableRows = [
      ["브랜드", function (r) { return esc(r.prod.brand || "-"); }],
      ["용량·규격", function (r) { return esc(r.prod.unit ? r.prod.unit.text : "-"); }],
      [esc(group.unitLabel), function (r) { return r.up ? "<b>" + num(r.up) + "원</b>" : "-"; }],
      ["판매 최저가", function (r) { return won(r.prod.price); }],
      ["평점·리뷰", function (r) { return (r.rating ? "★" + r.rating : "-") + " · " + (r.reviews ? compact(r.reviews) : "-"); }]
    ];
    var keys = [];
    [c.rows[0]].concat(group.products.slice(1).map(function (p) { return { prod: p }; })).forEach(function (r) {
      (r.prod.spec || []).forEach(function (x) { if (x[0] && keys.indexOf(x[0]) < 0 && keys.length < 4) keys.push(x[0]); });
    });
    keys.forEach(function (k) {
      tableRows.push([esc(k), function (r) {
        var hit = (r.prod.spec || []).filter(function (x) { return x[0] === k; })[0];
        return hit ? esc(hit[1]) : "-";
      }]);
    });

    var table = '<div class="section"><div class="section-head"><h3>스펙·단위가격 비교</h3>' +
      '<span class="hint">다나와 ' + date(group.observedAt) + ' 수집</span></div>' +
      '<div style="overflow-x:auto"><table class="rv-table"><thead><tr><th>항목</th>' +
      '<th class="mine">내 상품</th>' + c.rivals.map(function (p, i) { return "<th>라이벌 " + String.fromCharCode(65 + i) + "</th>"; }).join("") +
      '</tr></thead><tbody>' + tableRows.map(function (row) {
        return "<tr><td>" + row[0] + "</td>" + c.rows.map(function (r, i) {
          return '<td class="' + (i === 0 ? "mine" : "") + '">' + row[1](r) + "</td>";
        }).join("") + "</tr>";
      }).join("") + "</tbody></table></div></div>";

    var range = opts.range || 180;
    var series = trendSeries(group, my, range);
    var rangeChips = [[30, "1개월"], [90, "3개월"], [180, "6개월"], [365, "1년"]].map(function (x) {
      return '<button type="button" data-rv-range="' + x[0] + '" aria-pressed="' + (range === x[0]) + '">' + x[1] + "</button>";
    }).join("");
    var trendNote = "다나와 최저가 추이(주간)는 실제 관측값입니다. " +
      (my && my.buys ? "내 구매 " + my.buys + "회는 내가 실제 낸 가격(단위가격 환산)입니다." : "내 구매 기록은 아직 없습니다.");

    var cards = c.rows.map(function (r, i) { return cardHTML(r, group, c, i === 0); }).join("");

    return '<div class="rv-sum"><div class="rv-sum-k">' + esc(group.unitLabel) + ' 기준 실측 비교</div>' +
        '<div class="rv-sum-main"><span class="n tnum">' + (c.best && c.best.unitPrice ? num(c.best.unitPrice) + "원" : "-") + '<small>' + esc(group.unitLabel) + '</small></span>' +
        '<span class="d">라이벌 최저 · 내 상품 ' + (c.ref ? num(c.ref) + "원" : "-") + '</span></div>' +
        (diffText ? '<p>' + diffText + '</p>' : "") +
        '<div class="rv-sum-main" style="margin-top:10px"><span class="rv-sum-badge">' +
        (my && my.buys ? "내 기록 " + my.buys + "회 반영" : "공개 가격 기준") + '</span></div>' +
      '</div>' +
      '<div class="note" style="margin-top:10px">' + esc(myLine) + '</div>' +
      '<div class="section"><div class="section-head"><h3>내 상품 vs 라이벌 ' + c.rivals.length + '종</h3>' +
        '<span class="hint">' + esc((my && my.name) ? "내가 마지막으로 산 이름" : base.name.slice(0, 18)) + '</span></div>' +
        '<div class="rv-cards">' + cards + '</div></div>' +
      table +
      '<div class="section"><div class="section-head"><h3>가격 추이 비교</h3><span class="hint">' + esc(group.unitLabel) + ' 환산</span></div>' +
        '<div class="rv-range" data-rv-ranges>' + rangeChips + '</div>' +
        '<div style="margin-top:8px" data-rv-chart>' + chart(series, { note: trendNote, label: group.label + " 가격 추이" }) + '</div></div>' +
      '<div class="note" style="margin-top:12px">' +
        '가격은 수집 시점의 다나와 최저가, 추이는 다나와 최저가 추이(주간)입니다. 단위가격은 상품명의 용량·수량으로 계산했고, ' +
        '내 단위가격은 내가 실제 결제한 금액을 같은 방식으로 환산한 값입니다. 판매처·쿠폰에 따라 달라질 수 있습니다.' +
      '</div>';
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
          note: "다나와 최저가 추이(주간)의 실제 관측값입니다. 내 구매 기록은 내가 낸 단위가격으로 환산했습니다.",
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
      subtitle: "내 구매이력 × 다나와 라이벌 " + (group.products.length - 1) + "종",
      render: function (box) {
        box.innerHTML = compareHTML(group, my, opts);
        bindRanges(box, group, my);
      },
      footer: '<a class="btn btn-primary btn-sm" href="' + esc(group.products[0].url) + '" target="_blank" rel="noopener">내 상품 다나와에서 보기 ↗</a>' +
        '<span class="help" style="margin:0 0 0 auto">' + esc(group.observedAt) + ' 수집</span>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-act="close">닫기</button>' 
    });
  }

  /* 스트립 타일 */
  function tile(group, my) {
    var c = compare(group, my);
    var max = Math.max.apply(null, c.rows.map(function (r) { return r.up || 0; }).concat([1]));
    var bars = c.rows.map(function (r, i) {
      var w = Math.max(6, Math.round((r.up || 0) / max * 100));
      var myLabel = c.hasMine ? "내 상품" : "기준 상품";
      return '<div class="rv-bar' + (i === 0 ? " mine" : "") + '"><span>' + (i === 0 ? myLabel : (r.prod.brand || "라이벌")) +
        '</span><b class="tnum">' + (r.up ? num(r.up) + "원" : "-") + '</b><i><em style="width:' + w + '%"></em></i></div>';
    }).join("");
    var save = c.diff != null && c.diff < 0 ? "라이벌 " + Math.abs(c.diff) + "% 저렴"
      : c.diff > 0 ? "내 상품이 " + c.mineSave + "% 저렴" : "비슷한 가격";
    return '<button type="button" class="rv-tile" data-rv-open="' + esc(group.id) + '">' +
      '<span class="rv-tile-top"><span class="rv-tile-cat">' + esc(group.category) + '</span>' +
      '<span class="badge badge-green" style="margin-left:auto">' + group.products.length + '종</span></span>' +
      '<span class="rv-tile-name">' + esc(group.label) + (my && my.buys ? " · " + my.buys + "회 구매" : "") + '</span>' +
      '<span class="rv-tile-bars">' + bars + '</span>' +
      '<span class="rv-tile-foot"><span class="rv-tile-save">' + esc(save) + '</span><span class="rv-tile-more">비교 →</span></span>' +
      '</button>';
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
