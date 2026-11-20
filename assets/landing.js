/* `/` 공개 랜딩 — 히어로 사진 VS 보드 · 20품목 사진 보드 · 3초 체험 */
(function () {
  "use strict";
  var LC = window.LC, LCV = window.LetsCartRivals;
  var $ = function (id) { return document.getElementById(id); };
  var groups = [];

  function pad(n) { return String(n).length < 2 ? "0" + n : String(n); }
  function ago(days) {
    var d = new Date(Date.now() - days * 864e5);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function compactWon(n) {
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, "") + "만원";
    return Math.round(n).toLocaleString("ko-KR") + "원";
  }

  /* 체험용 샘플 구매이력(가상). 상품·가격·추이는 실제 다나와 값. */
  var SAMPLES = {
    ramen: {
      title: "라면",
      orders: [
        { date: ago(156), name: "농심 신라면 120g 40개입", price: 27800, qty: 1, mall: "쿠팡" },
        { date: ago(131), name: "농심 신라면 120g 40개입", price: 27400, qty: 1, mall: "쿠팡" },
        { date: ago(108), name: "농심 신라면 120g 40개입", price: 28900, qty: 1, mall: "네이버페이" },
        { date: ago(83), name: "농심 신라면 120g 40개입", price: 26900, qty: 1, mall: "쿠팡" },
        { date: ago(58), name: "농심 신라면 120g 40개입", price: 28200, qty: 1, mall: "G마켓" },
        { date: ago(33), name: "농심 신라면 120g 40개입", price: 27100, qty: 1, mall: "쿠팡" }
      ]
    },
    dumpling: {
      title: "만두",
      orders: [
        { date: ago(120), name: "비비고 물만두 1kg", price: 13760, qty: 1, mall: "쿠팡" },
        { date: ago(90), name: "비비고 물만두 1kg", price: 12900, qty: 1, mall: "쿠팡" },
        { date: ago(60), name: "비비고 물만두 1kg", price: 14200, qty: 1, mall: "마켓컬리" },
        { date: ago(30), name: "비비고 물만두 1kg", price: 13100, qty: 1, mall: "쿠팡" }
      ]
    },
    tissue: {
      title: "화장지",
      orders: [
        { date: ago(244), name: "깨끗한나라 순수 프리미엄 화장지 30m 30롤 (3팩)", price: 38900, qty: 1, mall: "쿠팡" },
        { date: ago(183), name: "깨끗한나라 순수 프리미엄 화장지 30m 30롤 (3팩)", price: 37900, qty: 1, mall: "쿠팡" },
        { date: ago(122), name: "깨끗한나라 순수 프리미엄 화장지 30m 30롤 (3팩)", price: 39500, qty: 1, mall: "G마켓" },
        { date: ago(61), name: "깨끗한나라 순수 프리미엄 화장지 30m 30롤 (3팩)", price: 38490, qty: 1, mall: "쿠팡" }
      ]
    }
  };
  var HERO_TABS = [
    { id: "ramen", label: "라면" },
    { id: "dumpling", label: "만두" },
    { id: "tissue", label: "화장지" }
  ];

  function byId(id) { return groups.filter(function (g) { return g.id === id; })[0]; }

  /* 1년(또는 1회) 절감액 — 샘플 주기·용량 기준 */
  function savingOf(group, my) {
    var c = LCV.compare(group, my);
    var base = group.products[0];
    var best = c.best;
    var mine = (my && my.avgUnit) ? my.avgUnit : base.unitPrice;
    if (!best || mine == null) return null;
    var diff = mine - best.unitPrice;
    if (diff <= 0) return null;
    var unit = base.unit || { qty: 1, per: 1 };
    var perOrder = diff * (unit.qty / unit.per);
    if (my && my.cycle) {
      return { value: compactWon(365 / my.cycle * perOrder), label: "1년 · 주기 " + my.cycle + "일" };
    }
    return { value: compactWon(perOrder), label: "1회 " + (unit.text || "") };
  }

  function shot(p, name, unit, mine) {
    return '<figure class="shot' + (mine ? " mine" : "") + '">' +
      '<span class="shot-tag">' + (mine ? "내 상품" : "라이벌") + '</span>' +
      (p.image ? '<img src="' + LC.esc(p.image) + '" alt="' + LC.esc(p.brand || name) + '" loading="lazy" width="240" height="240" />' : "") +
      '<figcaption class="shot-cap"><span class="shot-name">' + LC.esc(name) + '</span>' +
      '<span class="shot-price"><b class="tnum">' + LC.num(unit) + '</b><small>원</small></span></figcaption></figure>';
  }

  function renderBoard(id) {
    var box = $("heroBoard");
    if (!box) return;
    var g = byId(id) || groups[0];
    if (!g) return;
    var my = SAMPLES[g.id] ? LCV.myStats(SAMPLES[g.id].orders, g) : null;
    var c = LCV.compare(g, my);
    var base = g.products[0];
    var best = c.best || g.products[1] || base;
    var mineUnit = (my && my.avgUnit) ? my.avgUnit : base.unitPrice;
    var pct = c.diff == null ? null : Math.round(Math.abs(c.diff) * 10) / 10;
    var sv = savingOf(g, my);
    var tabs = HERO_TABS.map(function (t) {
      var tg = byId(t.id);
      if (!tg) return "";
      return '<button type="button" class="board-tab" role="tab" data-hero="' + t.id + '" aria-selected="' +
        (t.id === g.id) + '">' +
        (tg.products[0].image ? '<img src="' + LC.esc(tg.products[0].image) + '" alt="" width="30" height="30" loading="lazy" />' : "") +
        '<span>' + LC.esc(t.label) + '</span></button>';
    }).join("");

    box.innerHTML =
      '<div class="board-head"><span class="board-k">' + LC.esc(g.unitLabel) + '</span>' +
        '<span class="board-title">' + LC.esc(g.short || g.label) + '</span>' +
        LC.tip("다나와 최저가(" + LC.date(g.observedAt) + ")를 100g·100ml·1개·1롤 단위로 환산했습니다. 내 단위가격은 실제 결제 금액 기준입니다.", "단위가격 기준") +
      '</div>' +
      '<div class="board-stage">' +
        shot(base, base.brand || base.name.split(" ")[0], mineUnit, true) +
        '<span class="vs-dot">VS</span>' +
        shot(best, best.brand || best.name.split(" ")[0], best.unitPrice, false) +
      '</div>' +
      '<div class="board-save">' +
        (pct != null && c.diff < 0
          ? '<b class="tnum">−' + pct + '%</b><span>단가 차이<br>' + LC.esc(g.unitLabel) + ' 기준</span>'
          : '<b class="tnum">' + (pct ? "+" + pct + "%" : "—") + '</b><span>내 상품이 더 저렴</span>') +
        (sv ? '<span class="yr"><b class="tnum">' + sv.value + '</b><span>' + LC.esc(sv.label) + '</span></span>' : "") +
      '</div>' +
      '<div class="board-tabs" role="tablist" aria-label="품목 바꾸기">' + tabs + '</div>';

    box.querySelectorAll("[data-hero]").forEach(function (b) {
      b.addEventListener("click", function () { renderBoard(b.dataset.hero); });
    });
  }

  function renderStats() {
    if (!groups.length) return;
    var products = groups.reduce(function (s, g) { return s + g.products.length; }, 0);
    var hint = $("rivalHint");
    if (hint) hint.textContent = groups.length + "품목 · " + products + "상품 · " + LC.date(groups[0].observedAt).slice(5);
    var ch = $("catalogHint");
    if (ch) ch.textContent = "다나와 " + LC.date(groups[0].observedAt).slice(5);
  }

  function renderStrip() {
    var box = $("rivalStrip");
    if (!box) return;
    box.innerHTML = LCV.stripHTML(groups, []);
    LCV.bindStrip(box, groups, []);
  }

  function renderSample() {
    var ids = Object.keys(SAMPLES);
    var list = $("sampleList");
    var canvas = $("sampleCanvas");
    if (!list || !canvas) return;
    list.innerHTML = ids.map(function (id) {
      var g = byId(id);
      if (!g) return "";
      var my = LCV.myStats(SAMPLES[id].orders, g);
      return '<button type="button" class="sample-item" data-sample="' + id + '" aria-pressed="' + (ids[0] === id) + '">' +
        (g.products[0].image ? '<img src="' + LC.esc(g.products[0].image) + '" alt="" width="120" height="120" loading="lazy" />' : "") +
        '<span><span class="sample-t">' + LC.esc(SAMPLES[id].title) + '</span>' +
        '<span class="sample-s">' + my.buys + '회 · ' + (my.cycle || "-") + '일</span></span></button>';
    }).join("");

    function show(id) {
      var g = byId(id);
      if (!g) return;
      var my = LCV.myStats(SAMPLES[id].orders, g);
      canvas.innerHTML = LCV.compareHTML(g, my, { range: 90, compact: true }) +
        '<div class="sample-foot"><button type="button" class="btn btn-dark btn-sm" data-sample-open>전체 비교</button>' +
        '<span class="muted">가상 구매 기록 · 실제 다나와 가격</span></div>';
      list.querySelectorAll("[data-sample]").forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.dataset.sample === id));
      });
      LCV.bindRanges(canvas, g, my);
      var ob = canvas.querySelector("[data-sample-open]");
      if (ob) ob.addEventListener("click", function () { LCV.open(g, my, { range: 90 }); });
    }
    list.querySelectorAll("[data-sample]").forEach(function (b) {
      b.addEventListener("click", function () { show(b.dataset.sample); });
    });
    show(ids[0]);
  }

  function boot() {
    LCV.load().then(function (d) {
      groups = d.groups || [];
      renderStats();
      renderBoard(HERO_TABS[0].id);
      renderStrip();
      renderSample();
      LC.paintIcons();
    }).catch(function (e) {
      var hint = $("rivalHint");
      if (hint) hint.textContent = "라이벌 데이터를 불러오지 못했습니다 (" + ((e && e.message) || e) + ")";
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
  if (document.readyState !== "loading") boot();
})();
