/* `/` 공개 랜딩 — 라이벌 비교 스트립 · 히어로 보드 · 샘플 구매이력 체험 */
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

  /* 체험용 샘플 구매이력(가상). 상품·가격·추이는 실제 다나와 값. */
  var SAMPLES = {
    tissue: {
      title: "화장지", sub: "30롤 × 4번 · 61일 주기",
      orders: [
        { date: ago(244), name: "깨끗한나라 순수 프리미엄 화장지 30m 30롤", price: 20500, qty: 1, mall: "쿠팡" },
        { date: ago(183), name: "깨끗한나라 순수 프리미엄 화장지 30m 30롤", price: 19900, qty: 1, mall: "쿠팡" },
        { date: ago(122), name: "깨끗한나라 순수 프리미엄 화장지 30m 30롤", price: 21500, qty: 1, mall: "G마켓" },
        { date: ago(61), name: "깨끗한나라 순수 프리미엄 화장지 30m 30롤", price: 19400, qty: 1, mall: "쿠팡" }
      ]
    },
    ramen: {
      title: "라면", sub: "신라면 5개입 × 6번 · 24일 주기",
      orders: [
        { date: ago(156), name: "농심 신라면 120g 5개입", price: 4350, qty: 1, mall: "쿠팡" },
        { date: ago(131), name: "농심 신라면 120g 5개입", price: 4280, qty: 1, mall: "쿠팡" },
        { date: ago(108), name: "농심 신라면 120g 5개입", price: 4450, qty: 1, mall: "네이버페이" },
        { date: ago(83), name: "농심 신라면 120g 5개입", price: 4190, qty: 1, mall: "쿠팡" },
        { date: ago(58), name: "농심 신라면 120g 5개입", price: 4380, qty: 1, mall: "G마켓" },
        { date: ago(33), name: "농심 신라면 120g 5개입", price: 4090, qty: 1, mall: "쿠팡" }
      ]
    },
    milk: {
      title: "우유", sub: "서울우유 2.3L × 5번 · 11일 주기",
      orders: [
        { date: ago(58), name: "서울우유 나 100% 우유 2.3L", price: 5980, qty: 1, mall: "마켓컬리" },
        { date: ago(47), name: "서울우유 나 100% 우유 2.3L", price: 5680, qty: 1, mall: "쿠팡" },
        { date: ago(36), name: "서울우유 나 100% 우유 2.3L", price: 5980, qty: 1, mall: "마켓컬리" },
        { date: ago(24), name: "서울우유 나 100% 우유 2.3L", price: 5890, qty: 1, mall: "쿠팡" },
        { date: ago(13), name: "서울우유 나 100% 우유 2.3L", price: 5620, qty: 1, mall: "쿠팡" }
      ]
    }
  };

  function byId(id) { return groups.filter(function (g) { return g.id === id; })[0]; }

  function renderBoard() {
    var g = byId("ramen") || groups[0];
    if (!g || !$("heroAside")) return;
    var base = g.products[0];
    var rows = g.products.map(function (p, i) {
      return { p: p, mine: i === 0 };
    });
    var max = Math.max.apply(null, rows.map(function (r) { return r.p.unitPrice || 0; }).concat([1]));
    var best = g.products.slice(1).sort(function (a, b) { return a.unitPrice - b.unitPrice; })[0];
    var diff = best && base.unitPrice ? Math.round((best.unitPrice - base.unitPrice) / base.unitPrice * 1000) / 10 : null;
    $("heroAside").innerHTML = '<div class="hero-board">' +
      '<div class="hb-k">' + LC.icon("scale", "icon-sm") + " 실측 비교 · " + LC.esc(g.unitLabel) + '</div>' +
      '<div class="hb-title">' + LC.esc(g.label) + '</div>' +
      '<div class="hb-sub">다나와 최저가 · ' + LC.esc(g.observedAt) + ' 수집</div>' +
      rows.map(function (r) {
        var w = Math.max(6, Math.round((r.p.unitPrice || 0) / max * 100));
        return '<div class="hb-row' + (r.mine ? " mine" : "") + '"><div class="hb-line">' +
          '<span class="hb-name">' + (r.mine ? "내 상품" : (r.p.brand || "라이벌")) + " · " + LC.esc(r.p.unit ? r.p.unit.text : "") + '</span>' +
          '<span class="hb-price tnum">' + LC.num(r.p.unitPrice) + '원</span></div>' +
          '<div class="hb-bar"><i style="width:' + w + '%"></i></div></div>';
      }).join("") +
      '<div class="hb-foot">' + (diff != null && diff < 0 ? '<span class="hb-badge">라이벌 ' + Math.abs(diff) + '% 저렴</span>' : "") +
      '<span class="hb-note">' + LC.esc(best ? best.name.slice(0, 26) : "") + '…</span></div>' +
      '</div>';
  }

  function renderStats() {
    if (!groups.length) return;
    var products = groups.reduce(function (s, g) { return s + g.products.length; }, 0);
    $("hsGroups").textContent = groups.length;
    $("hsRivals").textContent = groups.reduce(function (s, g) { return s + g.products.length - 1; }, 0);
    $("hsObserved").textContent = groups[0].observedAt.slice(5).replace("-", ".");
    $("rivalHint").textContent = groups.length + "품목 · " + products + "상품 · " + groups[0].observedAt + " 수집";
    var hint = $("catalogHint");
    if (hint) hint.textContent = "다나와 스펙·평점·최저가 · " + groups.length + "개 라이벌 품목 포함";
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
    list.innerHTML = ids.map(function (id, i) {
      var g = byId(id); if (!g) return "";
      var s = SAMPLES[id];
      return '<button type="button" class="sample-item" data-sample="' + id + '" aria-pressed="' + (i === 0) + '">' +
        '<span style="min-width:0"><span class="sample-t">' + LC.esc(s.title) + '</span>' +
        '<span class="sample-s">' + LC.esc(s.sub) + '</span></span>' +
        '<span class="badge badge-green" style="margin-left:auto">' + LC.esc(g.products.length) + '종</span></button>';
    }).join("");
    function show(id) {
      var g = byId(id); if (!g) return;
      var my = LCV.myStats(SAMPLES[id].orders, g);
      canvas.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">' +
        '<span class="badge badge-blue">예시 구매 ' + my.buys + '회</span>' +
        '<span class="badge">' + LC.esc(my.cycle ? "주기 " + my.cycle + "일" : "") + '</span>' +
        '<span class="badge badge-green">' + LC.esc(g.products.length) + '종 비교</span></div>' +
        LCV.compareHTML(g, my, { range: 90 });
      list.querySelectorAll("[data-sample]").forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.dataset.sample === id));
      });
      LCV.bindRanges(canvas, g, my);
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
      renderBoard();
      renderStrip();
      renderSample();
    }).catch(function () {
      var hint = $("rivalHint");
      if (hint) hint.textContent = "라이벌 데이터를 불러오지 못했습니다";
    });
  }

  /* 카탈로그 통계(기존 공개 카탈로그가 채우는 값) */
  document.addEventListener("DOMContentLoaded", boot);
  if (document.readyState !== "loading") boot();
})();
