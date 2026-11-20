/* /local — 내 브라우저에서 시작하기 (렛츠카트 로컬 화면)
   · 서버·로그인 없이 localStorage + 확장(chrome.storage)만 사용
   · 렛츠바이 v0.18.3의 백업(letsbuy.v1)을 그대로 읽는다
   · Zero System UI: select/alert/confirm/prompt 미사용 */
(function () {
  "use strict";
  var LC = window.LC;
  var CORE = window.LetsCartCore || window.LetsBuy;
  var INS = window.LetsCartInsights || window.LetsBuyInsights;
  var ACT = window.LetsCartAction;
  var DEMO = window.LETSCART_DEMO;

  // 판정 범위 문구 — 화면 여러 곳에서 같은 말을 쓴다.
  var SCOPE_NOTE = "지금 살 것 판정은 반복 구매 가능한 실물 소모품만 다룹니다. 정산·결제·상품권·디지털·서비스는 구매 기록에만 남깁니다.";
  var STORE_KEY = "letscart.local.v1";
  var BACKUP_KEY = "letscart.backups.v1";
  const REQUIRED_EXTENSION_VERSION = '0.19.0';
  var ZIP = "../assets/letscart-extension-v0.19.0.zip";
  var PAGE = 24;

  var MARKET_LOGO = {
    "쿠팡": "coupang", "네이버페이": "npay", "네이버": "naver", "G마켓": "gmarket", "지마켓": "gmarket",
    "옥션": "auction", "11번가": "11st", "SSG": "ssg", "마켓컬리": "kurly", "컬리": "kurly",
    "롯데ON": "lotteon", "오늘의집": "ohou", "메가마트": "megamart", "배민": "baemin",
    "다나와": "danawa", "에누리": "enuri"
  };

  var state = {
    demo: false,
    tab: "shop",
    shop: { cat: null, view: "rep", sort: "verdict", shown: PAGE },
    spend: { mode: "split" },
    records: { q: "", filter: "all", shown: 40 },
    ext: { seen: false, version: null, health: null, at: null }
  };

  var $ = function (id) { return document.getElementById(id); };

  /* ------------------------------------------------------------ store */
  function blank() {
    return { schema: 3, orders: [], prices: {}, aliases: {}, cats: {}, ignored: {}, onboarded: true, updatedAt: null };
  }
  function loadStore() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { s = null; }
    s = Object.assign(blank(), s || {});
    if (!Array.isArray(s.orders)) s.orders = [];
    if (!s.prices || typeof s.prices !== "object") s.prices = {};
    return s;
  }
  var store = loadStore();
  function saveStore() {
    store.schema = 3;
    store.updatedAt = new Date().toISOString();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) {
      LC.toast("저장 공간이 부족합니다. 백업을 내려받아 주세요");
    }
  }
  function snapshot(reason) {
    try {
      if (!store.orders.length && !Object.keys(store.prices || {}).length) return false;
      var list = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
      list.unshift({ reason: reason, at: new Date().toISOString(), store: JSON.parse(JSON.stringify(store)) });
      localStorage.setItem(BACKUP_KEY, JSON.stringify(list.slice(0, 5)));
      return true;
    } catch (e) { return false; }
  }
  function snapshots() {
    try { return JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]"); } catch (e) { return []; }
  }

  function raw() {
    if (state.demo && DEMO) return { orders: DEMO.orders, prices: DEMO.prices, today: DEMO.today, aliases: {}, cats: {}, ignored: {} };
    return { orders: store.orders, prices: store.prices, today: LC.today(), aliases: store.aliases || {}, cats: store.cats || {}, ignored: store.ignored || {} };
  }

  var analysis = null;
  function build() {
    var d = raw();
    try {
      analysis = ACT.build(d, { cats: d.cats, ignored: d.ignored, aliases: d.aliases });
    } catch (e) {
      analysis = [];
      LC.toast("분석 중 오류: " + (e && e.message ? e.message : e));
    }
    return analysis;
  }

  /* ------------------------------------------------------------ helpers */
  function versionAtLeast(actual, required) {
    var a = String(actual || "0").split(".").map(Number), b = String(required || "0").split(".").map(Number);
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var x = a[i] || 0, y = b[i] || 0;
      if (x > y) return true;
      if (x < y) return false;
    }
    return true;
  }
  function logo(name, size) {
    var key = MARKET_LOGO[name];
    if (!key) return "";
    return '<img src="../assets/logos/' + key + '.webp" alt="" width="' + (size || 15) + '" height="' + (size || 15) + '" loading="lazy" style="width:' + (size || 15) + "px;height:" + (size || 15) + 'px" />';
  }
  var MARKET_COLOR = {
    "쿠팡": "#E52528", "네이버페이": "#03C75A", "네이버": "#03C75A", "G마켓": "#0B8A4B", "지마켓": "#0B8A4B",
    "옥션": "#E5261F", "11번가": "#FF0038", "SSG": "#C8102E", "마켓컬리": "#6B21A8", "컬리": "#6B21A8",
    "롯데ON": "#E60013", "오늘의집": "#00A5AD", "메가마트": "#0B5AA5", "배민": "#2AC1BC",
    "다나와": "#1b64da", "에누리": "#0F766E"
  };
  function marketColor(name) { return MARKET_COLOR[name] || "#8B95A1"; }
  function marketOf(x) { return x.src || String(x.mall || "").replace(/\s*최저$/, ""); }
  function ddayLabel(n) {
    if (n === null || n === undefined || n === 9999) return "";
    if (n < 0) return Math.abs(n) + "일 지남";
    if (n === 0) return "오늘";
    return "D-" + n;
  }
  function actBadge(v, big) {
    var m = ACT.kindMeta(v);
    return '<span class="act ' + m.cls + (big ? " act-lg" : "") + '">' + LC.esc(m.label) + "</span>";
  }
  function spark(points, w, h, color) {
    w = w || 74; h = h || 26;
    // 74px 폭에는 점을 14개까지 줄여 그린다(일별 값을 그대로 그리면 빗살처럼 보인다).
    var raw = points.map(function (x) { return x.price; });
    var v = raw.length <= 14 ? raw : (function () {
      var out = [], step = raw.length / 14;
      for (var i = 0; i < 14; i++) {
        var a = Math.floor(i * step), b = Math.max(a + 1, Math.floor((i + 1) * step));
        out.push(Math.min.apply(null, raw.slice(a, b)));
      }
      return out;
    })();
    if (v.length < 2) return '<svg class="spk" viewBox="0 0 ' + w + " " + h + '" aria-hidden="true"></svg>';
    var mn = Math.min.apply(null, v), mx = Math.max.apply(null, v);
    var x = function (i) { return (i / (v.length - 1) * (w - 2) + 1).toFixed(1); };
    var y = function (p) { return (h - 2 - (h - 4) * (p - mn) / ((mx - mn) || 1)).toFixed(1); };
    var d = v.map(function (p, i) { return (i ? "L" : "M") + x(i) + "," + y(p); }).join("");
    return '<svg class="spk" viewBox="0 0 ' + w + " " + h + '" aria-hidden="true">' +
      '<path d="' + d + "L" + x(v.length - 1) + "," + h + "L1," + h + 'Z" fill="' + color + '" opacity=".12"/>' +
      '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }
  function thumbImg(item) {
    if (item.img && /^https?:/.test(item.img)) {
      return '<img src="' + LC.esc(item.img) + '" alt="" loading="lazy" decoding="async" onerror="this.style.display=\'none\'" />';
    }
    return LC.icon("box", "icon-lg");
  }

  /* 헤더·히어로 */
  function renderChrome() {
    var d = raw();
    $("hsOrders").textContent = LC.num(d.orders.length);
    var items = analysis || build();
    $("hsItems").textContent = LC.num(items.length);
    var prices = 0;
    Object.keys(d.prices || {}).forEach(function (k) { prices += (d.prices[k] || []).length; });
    $("hsPrices").textContent = LC.num(prices) + "일";
    var nb = items.filter(function (x) { return x.verdict.k === "buy"; }).length;
    var nd = items.filter(function (x) { return x.verdict.k === "due"; }).length;
    $("hsVerdicts").textContent = LC.num(nb + nd) + "건";
    $("dataMode").textContent = state.demo ? "데모 데이터(가상)" : (store.orders.length ? "내 브라우저 저장소 " + LC.num(store.orders.length) + "건" : "아직 비어 있음");

    var aside = $("heroAside");
    var hasData = state.demo || store.orders.length;
    aside.innerHTML =
      '<div class="aside-row"><div class="aside-ico" style="background:var(--c-blue-weak);color:var(--c-blue)">' + LC.icon("lock") + "</div>" +
        '<div><div class="aside-k">데이터가 나가는 곳</div><div class="aside-v">없음<small>· 이 브라우저</small></div></div></div>' +
      '<div class="aside-row"><div class="aside-ico" style="background:var(--c-green-weak);color:var(--c-green-text)">' + LC.icon("tag") + "</div>" +
        '<div><div class="aside-k">지금 사면 좋은 품목</div><div class="aside-v tnum">' + nb + "<small>개</small></div></div></div>" +
      '<div class="aside-row"><div class="aside-ico" style="background:var(--c-red-weak);color:var(--c-red-text)">' + LC.icon("clock") + "</div>" +
        '<div><div class="aside-k">구매 주기가 온 품목</div><div class="aside-v tnum">' + nd + "<small>개</small></div></div></div>" +
      (!hasData ? '<div class="note" style="margin-top:10px">먼저 <b>데모로 보기</b>를 누르면 실제 화면을 바로 확인할 수 있습니다.</div>' : "");
  }

  function renderStart() {
    var n = store.orders.length;
    var prices = 0;
    Object.keys(store.prices || {}).forEach(function (k) { prices += (store.prices[k] || []).length; });
    $("storePanel").innerHTML =
      '<div class="setup-row"><div><b>구매 기록</b><span>' + LC.num(n) + "건 · 마지막 수정 " + (store.updatedAt ? LC.date(store.updatedAt) : "–") + "</span></div></div>" +
      '<div class="setup-row"><div><b>가격 추이</b><span>' + LC.num(prices) + "개 시점 · 품목 " + LC.num(Object.keys(store.prices || {}).length) + "개</span></div></div>" +
      '<div class="setup-row"><div><b>자동 백업</b><span>' + LC.num(snapshots().length) + "개 보관</span></div></div>" +
      (n ? "" : '<div class="notice" style="margin-top:8px">아직 비어 있습니다. <b>데모로 먼저 보기</b>로 화면을 확인하거나 확장·.eml로 채우세요.</div>');
    $("snapshotHint").textContent = LC.num(snapshots().length) + "개 보관";
    var zip = $("btnZip");
    if (zip) zip.setAttribute("href", ZIP);
  }

  function renderExt() {
    var pill = $("extPill"), txt = $("extPillText");
    var st = state.ext;
    if (!st.seen) {
      pill.dataset.state = "off";
      txt.textContent = "확장 연결 안 됨";
    } else if (!versionAtLeast(st.version, REQUIRED_EXTENSION_VERSION)) {
      pill.dataset.state = "old";
      txt.textContent = "확장 업데이트 필요";
    } else {
      pill.dataset.state = "on";
      txt.textContent = "확장 v" + st.version;
    }
    $("extVer").textContent = st.seen ? "v" + st.version : "연결 안 됨";

    var h = st.health;
    var rows =
      '<div class="setup-row"><div><b>연결</b><span>' + (st.seen ? "bridge.js 응답 확인 · v" + LC.esc(st.version || "?") + (st.at ? " · " + LC.esc(st.at) : "") : "이 페이지에서 확장을 찾지 못했습니다") + "</span></div>" +
      '<span class="act ' + (st.seen ? (versionAtLeast(st.version, REQUIRED_EXTENSION_VERSION) ? "act-buy" : "act-wait") : "act-ok") + '">' +
      (st.seen ? (versionAtLeast(st.version, REQUIRED_EXTENSION_VERSION) ? "정상" : "업데이트 필요") : "미연결") + "</span></div>" +
      (h ? '<div class="setup-row"><div><b>확장 자가진단</b><span>' + LC.esc(JSON.stringify(h).slice(0, 220)) + "</span></div></div>" : "") +
      '<div class="setup-row"><div><b>필요 버전</b><span>' + REQUIRED_EXTENSION_VERSION + " 이상 · " + (st.seen && !versionAtLeast(st.version, REQUIRED_EXTENSION_VERSION) ? "<b style='color:var(--c-amber-text)'>확장 업데이트 필요</b>" : "현재 버전 확인") + "</span></div></div>";

    var actions =
      '<div class="step-actions" style="margin-top:10px">' +
      '<button class="btn btn-ghost btn-sm" id="btnPing">' + LC.icon("refresh", "icon-sm") + "연결 자가진단</button>" +
      '<a class="btn btn-ghost btn-sm" href="' + ZIP + '" download>' + LC.icon("box", "icon-sm") + "확장 ZIP</a>" +
      "</div>" +
      '<div class="notice" style="margin-top:8px">설치: ZIP 압축을 푼 뒤 크롬 <b>chrome://extensions</b> → 개발자 모드 → “압축해제된 확장 프로그램 로드”에서 폴더를 고릅니다.</div>';

    $("extPanel").innerHTML = rows + actions;
    $("extDiag").innerHTML = rows + actions;
    ["btnPing"].forEach(function (id) {
      var b = $(id);
      if (b && !b.dataset.bound) {
        b.dataset.bound = "1";
        b.addEventListener("click", ping);
      }
    });
  }

  /* ------------------------------------------------------------ extension bridge */
  function post(type, extra) {
    var msg = Object.assign({ app: "letsbuy-web", type: type }, extra || {});
    window.postMessage(msg, location.origin);
  }
  function ping() {
    post("pull");
    post("health");
    LC.toast("확장에 연결을 요청했습니다");
    setTimeout(function () { if (!state.ext.seen) renderExt(); }, 1200);
  }
  window.addEventListener("message", function (e) {
    if (e.source !== window || !e.data || e.data.app !== "letsbuy-ext") return;
    var d = e.data;
    if (d.type === "hello") {
      state.ext.seen = true;
      state.ext.version = d.version || state.ext.version;
      state.ext.at = new Date().toISOString().slice(11, 19);
      renderExt();
    }
    if (d.type === "health") {
      state.ext.seen = true;
      state.ext.health = d.health || null;
      renderExt();
    }
    if (d.type === "data") {
      state.ext.seen = true;
      state.ext.version = d.version || state.ext.version;
      renderExt();
      var hasOrders = (d.orders || []).length > 0;
      if (hasOrders) merge(d.orders, d.prices, true);
      else if ((d.stats || null) && !store.orders.length) LC.toast("확장은 연결됐지만 저장된 구매 기록이 아직 없습니다");
    }
  });
  setTimeout(function () { post("pull"); }, 400);

  /* ------------------------------------------------------------ merge */
  function merge(orders, prices, fromExt) {
    orders = CORE.dedupe(orders || []);
    if (fromExt && orders.length) store.orders = store.orders.filter(function (o) { return o.source === "paste"; });
    var seen = {};
    store.orders.forEach(function (o) { seen[o.date + "|" + o.name] = 1; });
    orders.forEach(function (o) {
      var k = o.date + "|" + o.name;
      if (!seen[k]) { store.orders.push(o); seen[k] = 1; }
    });
    Object.keys(prices || {}).forEach(function (k) {
      var map = {};
      (store.prices[k] || []).forEach(function (p) { map[p.date + "|" + (p.src || p.mall)] = p; });
      (prices[k] || []).forEach(function (p) { map[p.date + "|" + (p.src || p.mall)] = p; });
      store.prices[k] = Object.keys(map).map(function (x) { return map[x]; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    });
    store.orders = CORE.dedupe(store.orders);
    saveStore();
    state.demo = false;
    refreshAll();
  }

  /* ------------------------------------------------------------ shop */
  function shopItems() {
    var all = analysis || build();
    return all.filter(function (p) { return p.profile && p.profile.recommend; });
  }
  function renderShop() {
    var all = shopItems();
    var rep = all.filter(function (p) { return p.count >= 2; });
    var base = state.shop.view === "rep" && rep.length ? rep : all;
    var list = base.filter(function (p) { return !state.shop.cat || p.cat === state.shop.cat; });

    var nb = list.filter(function (p) { return p.verdict.k === "buy"; }).length;
    var ns = list.filter(function (p) { return p.verdict.k === "soon"; }).length;
    var nw = list.filter(function (p) { return p.verdict.k === "wait"; }).length;
    var nd = list.filter(function (p) { return p.verdict.k === "due"; }).length;
    $("vsum").innerHTML =
      '<span><b style="--v:#087f5b">' + nb + "</b>지금 사세요</span>" +
      '<span><b style="--v:#1b64da">' + ns + "</b>곧 떨어져요</span>" +
      '<span><b style="--v:#c92a2a">' + nd + "</b>살 때 됐어요</span>" +
      '<span><b style="--v:#d9480f">' + nw + "</b>기다리세요</span>";
    $("nShop").textContent = all.length ? LC.num(all.length) : "";

    var cats = [];
    base.forEach(function (p) { if (cats.indexOf(p.cat) < 0) cats.push(p.cat); });
    var chipHtml = '<button class="chip" data-value="" aria-pressed="' + (!state.shop.cat ? "true" : "false") + '">전체 <span class="count tnum">' + base.length + "</span></button>";
    cats.forEach(function (c) {
      var n = base.filter(function (p) { return p.cat === c; }).length;
      chipHtml += '<button class="chip" data-value="' + LC.esc(c) + '" aria-pressed="' + (state.shop.cat === c ? "true" : "false") + '">' +
        LC.esc(c) + ' <span class="count tnum">' + n + "</span></button>";
    });
    var chips = $("shopCats");
    if (chips.dataset.built !== chipHtml) {
      chips.innerHTML = chipHtml;
      chips.dataset.built = chipHtml;
    }

    var sorts = {
      verdict: function (a, b) { return b.score - a.score; },
      saving: function (a, b) { return saving(b) - saving(a); },
      count: function (a, b) { return b.count - a.count; },
      due: function (a, b) { return (a.daysLeft === undefined ? 9999 : a.daysLeft) - (b.daysLeft === undefined ? 9999 : b.daysLeft); },
      name: function (a, b) { return String(a.name).localeCompare(String(b.name), "ko"); }
    };
    list = list.slice().sort(sorts[state.shop.sort] || sorts.verdict);

    $("shopCount").innerHTML = "<b>" + LC.num(list.length) + "</b>개 품목" +
      (state.shop.cat ? " · " + LC.esc(state.shop.cat) : "") +
      (state.shop.view === "rep" ? " · 두 번 이상 산 것" : "");
    if (!list.length) {
      $("shopGrid").innerHTML = '<div class="empty" style="grid-column:1/-1"><h3>' + (all.length ? "조건에 맞는 품목이 없습니다" : "아직 분석할 구매 기록이 없습니다") + "</h3>" +
        "<p>" + (all.length ? "분류 칩을 바꿔 보세요." : "데모로 먼저 보기 또는 .eml·백업 JSON으로 기록을 넣어 주세요.") + "</p></div>";
      $("shopMore").innerHTML = "";
      return;
    }
    var slice = list.slice(0, state.shop.shown);
    $("shopGrid").innerHTML = slice.map(card).join("");
    $("shopMore").innerHTML = list.length > state.shop.shown
      ? '<button class="btn btn-ghost" data-more="1">더 보기 (' + LC.num(list.length - state.shop.shown) + "개)</button>" : "";
  }
  function saving(p) {
    if (!p.now || !p.myLast) return 0;
    return Math.max(0, p.myLast.price - p.now.price);
  }
  function seriesOf(p) {
    var s = (p.series && p.series.length ? p.series : []).map(function (x) { return { date: x.date, price: x.price }; });
    if (s.length >= 2) return s;
    return (p.prices || []).slice(-12);
  }
  function card(p) {
    var price = p.now ? p.now.price : (p.myLast ? p.myLast.price : null);
    var sp = seriesOf(p);
    var unit = p.myLast ? ACT.unitOf(p.name, p.myLast.price, 1) : null;
    return '<button class="scard" data-key="' + LC.esc(p.key) + '" aria-label="' + LC.esc(p.name) + ' 판정 상세">' +
      '<span class="thumb">' + thumbImg(p) + "</span>" +
      '<span class="scard-main">' +
        '<span class="scard-top">' + actBadge(p.verdict) +
          (p.count >= 2 && p.verdict.k !== "due" ? '<span class="scard-meta">' + ddayLabel(p.daysLeft) + "</span>" : "") + "</span>" +
        '<span class="scard-name">' + LC.text(p.name) + "</span>" +
        '<span class="scard-meta">' + p.count + "회 · 마지막 " + (p.myLast ? LC.won(p.myLast.price) : "–") +
          (p.avgGap ? " · 주기 " + p.avgGap + "일" : "") + "</span>" +
        '<span class="scard-price">' +
          (price ? '<b class="tnum">' + LC.num(price) + "</b>" +
            (p.now ? '<small><i class="mdot" style="background:' + marketColor(p.now.src) + '"></i>' + LC.esc(p.now.src) + " 지금</small>" : '<small>내 마지막</small>')
            : '<b class="tnum">가격 모으는 중</b>') +
        "</span>" +
        '<span class="scard-foot">' + spark(sp, 74, 26, p.verdict.k === "buy" ? "#0ca678" : p.verdict.k === "wait" ? "#f08c00" : "#3182f6") +
          (unit ? '<span class="unit">' + LC.esc(unit.label) + " " + LC.won(unit.value) + "</span>" : '<span class="muted">단위가격 미산출</span>') +
        "</span>" +
      "</span></button>";
  }

  function chart(p) {
    var mine = (p.prices || []).slice(-24);
    var live = (p.series || []).slice(-60);
    var all = mine.concat(live.map(function (x) { return { date: x.date, price: x.price }; }));
    if (all.length < 2) return '<div class="notice">가격 기록이 2개 이상 쌓이면 추이가 보입니다.</div>';
    var W = 320, H = 120, padL = 6, padR = 6, padT = 8, padB = 16;
    var vals = all.map(function (x) { return x.price; });
    var mn = Math.min.apply(null, vals) * 0.97, mx = Math.max.apply(null, vals) * 1.03;
    var d0 = all[0].date, d1 = all[all.length - 1].date;
    var t0 = new Date(d0 + "T00:00:00Z").getTime(), t1 = new Date(d1 + "T00:00:00Z").getTime();
    var span = Math.max(1, t1 - t0);
    var X = function (d) { return padL + (new Date(d + "T00:00:00Z").getTime() - t0) / span * (W - padL - padR); };
    var Y = function (v) { return padT + (H - padT - padB) * (1 - (v - mn) / ((mx - mn) || 1)); };
    var line = mine.map(function (x, i) { return (i ? "L" : "M") + X(x.date).toFixed(1) + " " + Y(x.price).toFixed(1); }).join(" ");
    var liveLine = live.map(function (x, i) { return (i ? "L" : "M") + X(x.date).toFixed(1) + " " + Y(x.price).toFixed(1); }).join(" ");
    var dots = mine.map(function (x) {
      return '<circle cx="' + X(x.date).toFixed(1) + '" cy="' + Y(x.price).toFixed(1) + '" r="2.6" fill="#8B95A1" />';
    }).join("");
    return '<div class="mchart"><svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="내 구매가와 최근 최저가 추이">' +
      (liveLine ? '<path d="' + liveLine + '" fill="none" stroke="#3182F6" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" opacity=".9"/>' : "") +
      (line ? '<path d="' + line + '" fill="none" stroke="#8B95A1" stroke-width="1.6" stroke-dasharray="3 3"/>' : "") +
      dots +
      '<text x="' + padL + '" y="' + (H - 2) + '" font-size="8.5" fill="#8B95A1">' + LC.shortDate(d0) + "</text>" +
      '<text x="' + (W - padR) + '" y="' + (H - 2) + '" font-size="8.5" fill="#8B95A1" text-anchor="end">' + LC.shortDate(d1) + "</text>" +
      "</svg></div>" +
      '<div class="legend"><span><i style="background:#8B95A1"></i>내가 낸 가격</span><span><i style="background:#3182f6"></i>최근 최저가</span></div>';
  }

  function openDetail(p) {
    var price = p.now ? p.now.price : null;
    var cells = [];
    if (p.now) cells.push(["지금 최저", LC.won(p.now.price)]);
    if (p.myLast) cells.push(["내 마지막", LC.won(p.myLast.price)]);
    if (p.yearAgo) cells.push(["작년 이맘때", LC.won(p.yearAgo.price)]);
    if (p.count >= 2) cells.push(["사는 주기", p.avgGap + "일"]);
    var unit = p.myLast ? ACT.unitOf(p.name, p.myLast.price, 1) : null;
    if (unit) cells.push([unit.label, LC.won(unit.value)]);

    LC.sheet({
      title: p.name,
      subtitle: p.cat + (p.sub ? " · " + p.sub : ""),
      variant: "sheet-detail",
      render: function (b) {
        b.innerHTML =
          '<div class="detail-hero"><div class="thumb">' + thumbImg(p) + "</div><div>" +
            '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px">' + actBadge(p.verdict, true) +
              (p.verdict.basis ? '<span class="pill-k">' + LC.esc(p.verdict.basis) + "</span>" : "") + "</div>" +
            '<div class="item-name">' + LC.text(p.name) + "</div>" +
            '<div class="item-spec">' + p.count + "회 구매" + (p.myLast ? " · 마지막 " + LC.date(p.myLast.date) : "") +
              (p.count >= 2 ? " · " + ddayLabel(p.daysLeft) : "") + "</div>" +
          "</div></div>" +
          '<div class="price-hero" style="margin-top:12px">' +
            '<div class="price-hero-main"><b class="tnum">' + (price ? LC.num(price) : "–") + "</b><span>원" +
              (p.now ? " · " + LC.esc(p.now.src) + " 최저" : "") + "</span></div>" +
            '<div class="price-cells">' + cells.map(function (c) {
              return '<div class="cell"><div class="cell-k">' + LC.esc(c[0]) + '</div><div class="cell-v tnum">' + c[1] + '</div></div>';
            }).join("") + "</div>" +
            '<div class="derive">' + LC.esc(p.say || "") + "</div>" +
          "</div>" +
          (p.shrink ? '<div class="shrink-note">' + LC.icon("info", "icon-sm") +
            "<span>지금 파는 규격이 내가 산 것보다 <b>" + p.shrink.pct + "%</b> 적어요 — 같은 값이면 슈링크플레이션입니다.</span></div>" : "") +
          '<div class="section"><div class="section-head"><h3>가격 추이</h3><span class="hint">내 구매 · 최근 최저가</span></div>' + chart(p) + "</div>" +
          (p.sources && p.sources.length ? '<div class="section"><div class="section-head"><h3>지금 가격</h3><span class="hint">검색 최저가</span></div>' +
            p.sources.map(function (s) {
              return '<a class="mkt-row" href="' + LC.esc(s.url || "#") + '" target="_blank" rel="noopener">' +
                '<span class="logo-row">' + logo(s.src, 16) + "<span>" + LC.esc(s.src) + "</span></span>" +
                '<b class="tnum">' + LC.won(s.price) + "</b></a>";
            }).join("") + "</div>" : '<div class="section"><div class="notice">지금 최저가는 확장이 하루 한 번 모읍니다. 설치하면 이 자리에 마켓별 가격이 붙습니다.</div></div>') +
          '<div class="section"><div class="section-head"><h3>내 구매 기록</h3><span class="hint">' + p.count + "회</span></div>" +
            ((p.prices || []).slice().reverse().slice(0, 12).map(function (o) {
              return '<div class="mkt-row"><span class="logo-row">' + logo(o.mall, 16) + "<span>" + LC.esc(o.mall) + "</span></span>" +
                '<span class="muted tnum" style="font-size:11px">' + LC.date(o.date) + '</span><b class="tnum">' + LC.won(o.price) + "</b></div>";
            }).join("") || '<div class="notice">가격이 기록된 구매가 없습니다.</div>') +
          "</div>" +
          '<div class="section"><div class="notice"><b>' + LC.esc(p.profile.reason || "") + "</b> — " + SCOPE_NOTE +
            " 이 판정은 내 구매 기록과 최근 가격만으로 계산합니다. 실제 결제 전 가격·구성을 한 번 더 확인해 주세요.</div></div>";
      },
      footer: '<button class="btn btn-ghost" data-act="close">닫기</button>' +
        (p.now && p.now.url ? '<a class="btn btn-primary" href="' + LC.esc(p.now.url) + '" target="_blank" rel="noopener">' + LC.esc(p.now.src) + "에서 보기</a>" : "")
    });
  }

  /* ------------------------------------------------------------ spend */
  function renderSpend() {
    var d = raw();
    var A = INS.insights(d.orders, { today: d.today, cats: d.cats || {}, aliases: d.aliases, prices: d.prices });
    var split = state.spend.mode === "split";
    var total = split ? A.total.spend : d.orders.reduce(function (s, o) { return s + (o.price || 0); }, 0);
    var rows = split ? A.total.count : d.orders.length;

    $("spendKpis").innerHTML = [
      { k: "총 지출", v: LC.compact(total) + "<small>원</small>", s: LC.num(rows) + "행 · " + (split ? "정산·결제 분리" : "원장 그대로"), cls: "kpi-accent" },
      { k: "분석 품목", v: LC.num(A.total.items) + "<small>개</small>", s: "재구매 후보 " + A.quality.recommendable + " · 가격 추적 " + A.quality.priceTrackable },
      { k: "정산·결제 분리", v: LC.num(A.quality.excluded) + "<small>행</small>", s: "포인트·쿠폰·배송비·상품권 등" },
      { k: "슈링크플레이션", v: LC.num(A.shrink.length) + "<small>건</small>", s: "같은 값, 줄어든 용량" }
    ].map(function (c) {
      return '<div class="kpi ' + (c.cls || "") + '"><div class="kpi-k">' + c.k + '</div><div class="kpi-v tnum">' + c.v + '</div><div class="kpi-s">' + c.s + "</div></div>";
    }).join("");

    // 월별 막대
    var ms = A.monthly;
    var maxM = Math.max.apply(null, ms.map(function (m) { return m.spend; }).concat([1]));
    var W = 340, H = 118, padB = 16, padT = 8;
    var bw = (W - 2) / ms.length;
    var bars = ms.map(function (m, i) {
      var h = (H - padB - padT) * (m.spend / maxM);
      var x = 1 + i * bw;
      var show = i % 4 === 0 || i === ms.length - 1;
      return '<rect x="' + x.toFixed(1) + '" y="' + (H - padB - h).toFixed(1) + '" width="' + Math.max(2, bw - 1.4).toFixed(1) +
        '" height="' + Math.max(0.5, h).toFixed(1) + '" rx="1.6" fill="' + (i === ms.length - 1 ? "#3182f6" : "#bcd4f7") + '">' +
        "<title>" + m.m + " · " + LC.won(m.spend) + " · " + m.count + "행</title></rect>" +
        (show ? '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 3) + '" font-size="8" fill="#8B95A1" text-anchor="middle">' + m.m.slice(2, 4) + "." + m.m.slice(5) + "</text>" : "");
    }).join("");
    $("monthHint").textContent = "최근 " + ms.length + "개월 · 최고 " + LC.won(maxM);
    $("monthChart").innerHTML = '<div class="mchart"><svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="월별 지출 막대 그래프">' + bars + "</svg></div>" +
      '<div class="notice" style="margin-top:6px">작년 같은 12개월 대비 <b>' + (A.yoy.pct === null ? "–" : (A.yoy.pct > 0 ? "+" : "") + A.yoy.pct + "%") + "</b>" +
      " · 이번 12개월 " + LC.won(A.yoy.cur) + " / 지난 12개월 " + LC.won(A.yoy.prev) + "</div>";

    // 카테고리
    var cats = A.byCat.slice().sort(function (a, b) { return b.spend - a.spend; }).slice(0, 10);
    var maxC = Math.max.apply(null, cats.map(function (c) { return c.spend; }).concat([1]));
    $("catBars").innerHTML = cats.length ? cats.map(function (c) {
      return '<div class="bar-row"><div class="bar-name"><i style="width:7px;height:7px;border-radius:50%;background:' + c.color + ';display:inline-block;flex:none"></i>' +
        "<span>" + LC.esc(c.cat) + "</span></div>" +
        '<div class="bar-track"><div class="bar-fill" style="width:' + Math.max(2, Math.round(c.spend / maxC * 100)) + "%;background:" + c.color + '"></div></div>' +
        '<div class="bar-val tnum">' + LC.compact(c.spend) + "원<small>" + c.items + "품목 · " + c.count + "행</small></div></div>";
    }).join("") : '<div class="notice">표시할 지출이 없습니다.</div>';

    // 단위가격
    var units = [];
    A.items.forEach(function (it) {
      if (!it.profile.priceTrack) return;
      var last = (it.list || []).filter(function (o) { return o.price; }).slice(-1)[0];
      if (!last) return;
      var u = INS.unitPrice(last.name, last.price, last.qty || 1);
      if (!u) return;
      units.push({ name: it.name, cat: it.cat, unit: u, price: last.price, date: last.date, count: it.count });
    });
    units.sort(function (a, b) { return b.count - a.count || b.price - a.price; });
    $("unitTable").innerHTML = units.length
      ? '<div class="table-scroll"><table class="utable"><thead><tr><th>품목</th><th style="text-align:right">낸 값</th><th style="text-align:right">단위가격</th></tr></thead><tbody>' +
        units.slice(0, 12).map(function (u) {
          return "<tr><td><span class=\"tn\">" + LC.text(u.name) + "</span></td>" +
            '<td class="num">' + LC.won(u.price) + '</td><td class="num">' + LC.won(u.unit.value) + "<br><span class=\"muted\" style=\"font-weight:600;font-size:10px\">" + LC.esc(u.unit.label) + "</span></td></tr>";
        }).join("") + "</tbody></table></div>"
      : '<div class="notice">상품명에 용량·개수가 있는 품목이 아직 없습니다.</div>';

    // 슈링크플레이션
    $("shrinkList").innerHTML = A.shrink.length
      ? '<div class="mini-list">' + A.shrink.slice(0, 8).map(function (c) {
        return '<div class="mini"><span><span class="mini-t">' + LC.text(c.name) + "</span>" +
          '<span class="mini-s">' + LC.esc((c.s0 ? c.s0.total + c.s0.unit : "?")) + " → " + LC.esc((c.s1 ? c.s1.total + c.s1.unit : "?")) +
          " · " + LC.date(c.from) + " → " + LC.date(c.to) + "</span></span>" +
          '<span class="mini-v" style="color:var(--c-amber-text)">용량 −' + c.shrink + "%</span></div>";
      }).join("") + "</div>"
      : '<div class="notice">같은 값에 용량이 줄어든 품목은 아직 없습니다. (468g → 444g 같은 변화를 잡아냅니다)</div>';

    // 가격 변화
    var counts = {};
    (A.items || []).forEach(function (it) { counts[it.key] = it.count; });
    var ch = A.changes.slice().sort(function (a, b) { return Math.abs(b.pct) - Math.abs(a.pct); }).slice(0, 10);
    $("changeList").innerHTML = ch.length
      ? '<div class="mini-list">' + ch.map(function (c) {
        var up = c.pct > 0;
        var n = counts[c.key];
        return '<div class="mini"><span><span class="mini-t">' + LC.text(c.name) + "</span>" +
          '<span class="mini-s">' + LC.won(c.p0) + " → " + LC.won(c.p1) + (n ? " · " + n + "회" : "") + " · " + LC.date(c.from) + "~" + LC.date(c.to) + "</span></span>" +
          '<span class="mini-v" style="color:' + (up ? "var(--c-red-text)" : "var(--c-green-text)") + '">' + (up ? "+" : "") + c.pct + "%</span></div>";
      }).join("") + "</div>"
      : '<div class="notice">가격이 3회 이상 기록된 품목이 아직 없습니다.</div>';
  }

  /* ------------------------------------------------------------ records */
  function profileOf(name) {
    var hit = null;
    if (analysis) {
      var k = CORE.keyOf(name);
      hit = analysis.find(function (x) { return x.key === k; }) || null;
    }
    return (hit && hit.profile) ? hit.profile : CORE.itemProfile(name);
  }
  function renderRecords() {
    var d = raw();
    var q = state.records.q.toLowerCase();
    var rows = d.orders.slice().filter(function (o) {
      var p = profileOf(o.name);
      if (state.records.filter === "settle" && p.includeSpend !== false) return false;
      if (state.records.filter === "digital" && p.category !== "디지털·서비스") return false;
      if (state.records.filter === "review" && !(p.confidence < 0.75 && p.entity === "physical")) return false;
      if (q && (String(o.name) + " " + String(o.mall)).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });

    $("nRecords").textContent = d.orders.length ? LC.num(d.orders.length) : "";
    $("rCount").innerHTML = "<b>" + LC.num(rows.length) + "</b>행" +
      (state.records.q ? ' · "' + LC.esc(state.records.q) + '"' : "") +
      (state.records.filter !== "all" ? " · " + ({ review: "검토 필요", settle: "정산·결제", digital: "디지털·서비스" })[state.records.filter] : "") +
      " · 합계 <b>" + LC.num(rows.reduce(function (s, o) { return s + (o.price || 0); }, 0)) + "</b>원";

    if (!rows.length) {
      $("rList").innerHTML = '<div class="empty"><h3>' + (d.orders.length ? "조건에 맞는 기록이 없습니다" : "아직 구매 기록이 없습니다") + "</h3>" +
        "<p>" + (d.orders.length ? "검색어나 필터를 바꿔 보세요." : ".eml을 끌어다 놓거나 백업 JSON을 불러오세요.") + "</p></div>";
      $("rMore").innerHTML = "";
      return;
    }
    $("rList").innerHTML = rows.slice(0, state.records.shown).map(function (o, i) {
      var p = profileOf(o.name);
      var pill = p.includeSpend === false ? '<span class="pill-k settle">정산·결제</span>'
        : p.category === "디지털·서비스" ? '<span class="pill-k digital">디지털·서비스</span>'
        : p.confidence < 0.75 && p.entity === "physical" ? '<span class="pill-k review">검토 필요</span>'
        : "";
      var unit = o.qty > 1 ? Math.round((o.price || 0) / o.qty) : null;
      return '<button class="rrow" data-i="' + rows.indexOf(o) + '">' +
        '<span class="rrow-top"><span class="rrow-date">' + LC.date(o.date) + "</span>" +
          '<span class="mk">' + LC.esc(o.mall || "–") + "</span>" + pill + "</span>" +
        '<span class="rrow-right"><span class="rrow-price tnum">' + LC.won(o.price) + "</span>" +
          '<span class="rrow-meta">' + (o.qty || 1) + "개" + (unit ? " · 개당 " + LC.num(unit) : "") + "</span></span>" +
        '<span class="rrow-name">' + LC.text(o.name) + "</span></button>";
    }).join("");
    $("rMore").innerHTML = rows.length > state.records.shown
      ? '<button class="btn btn-ghost" data-more="1">더 보기 (' + LC.num(rows.length - state.records.shown) + "건)</button>" : "";
    $("rList").querySelectorAll("[data-i]").forEach(function (b) {
      b.addEventListener("click", function () { openRecord(rows[+b.dataset.i]); });
    });
  }
  function openRecord(o) {
    var p = profileOf(o.name);
    var u = INS.unitPrice(o.name, o.price, o.qty || 1);
    LC.sheet({
      title: o.name,
      subtitle: LC.date(o.date) + " · " + LC.esc(o.mall || ""),
      render: function (b) {
        var rows = [
          ["금액", LC.won(o.price)],
          ["수량", (o.qty || 1) + "개"],
          ["개당", o.qty > 1 ? LC.won(Math.round(o.price / o.qty)) : "–"],
          ["단위가격", u ? u.label + " " + LC.won(u.value) : "–"],
          ["분류", p.category || "미분류"],
          ["재구매 추천", p.recommend ? "대상" : "제외"]
        ];
        b.innerHTML = '<div class="spec-table">' + rows.map(function (r) {
          return '<div class="spec-row"><div class="k">' + r[0] + '</div><div class="v">' + LC.esc(r[1]) + "</div></div>";
        }).join("") + "</div>" +
          '<div class="section"><div class="section-head"><h3>왜 이렇게 다뤘나</h3></div>' +
          '<div class="note">' + LC.esc(p.reason || "") + "</div></div>" +
          (o.orderNo ? '<div class="section"><div class="notice">주문번호 ' + LC.esc(o.orderNo) + "</div></div>" : "");
      },
      footer: '<button class="btn btn-ghost" data-act="close">닫기</button>'
    });
  }

  /* ------------------------------------------------------------ imports */
  function emlFiles(files) {
    files = Array.prototype.slice.call(files || []).filter(function (f) {
      return /\.eml$/i.test(f.name) || f.type === "message/rfc822";
    });
    if (!files.length) { LC.toast(".eml 파일만 읽을 수 있습니다"); return; }
    if (files.length > 50) files = files.slice(0, 50);
    $("dropMsg").textContent = "읽는 중…";
    var found = [], none = 0, done = 0;
    files.forEach(function (f) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var bin = reader.result;
          var parsed = CORE.parseEml(bin);
          var r = CORE.parseMail(parsed).filter(function (o) { return o.date; }).map(function (o) { return Object.assign(o, { source: "paste" }); });
          if (r.length) found = found.concat(r); else none++;
        } catch (e) { none++; }
        if (++done === files.length) finish();
      };
      reader.onerror = function () { none++; if (++done === files.length) finish(); };
      reader.readAsBinaryString(f);
    });
    function finish() {
      var msg = files.length + "개 메일 · 상품 " + found.length + "개" + (none ? " · " + none + "개는 읽지 못함" : "");
      $("dropMsg").textContent = "";
      $("dropNote").textContent = msg;
      LC.toast(msg);
      if (found.length) {
        snapshot(".eml 가져오기 전");
        merge(found);
        setTab("shop");
      }
    }
  }
  function jsonFile(f) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var j = JSON.parse(reader.result);
        var orders = j.orders || (Array.isArray(j) ? j : []);
        var prices = j.prices || {};
        if (!orders.length && !Object.keys(prices).length) { LC.toast("이 파일에는 주문·가격이 없습니다"); return; }
        snapshot("백업 불러오기 전");
        if (j.aliases) store.aliases = j.aliases;
        if (j.cats) store.cats = j.cats;
        if (j.ignored) store.ignored = j.ignored;
        merge(orders, prices, false);
        LC.toast("백업에서 " + LC.num(orders.length) + "건을 불러왔습니다");
      } catch (e) {
        LC.toast("JSON을 읽지 못했습니다");
      }
    };
    reader.readAsText(f);
  }

  function openPaste() {
    var s = LC.sheet({
      title: "메일 붙여넣기",
      subtitle: "주문·결제 메일 본문을 그대로 붙여넣으세요. 이 브라우저에서만 해석합니다.",
      render: function (b) {
        b.innerHTML =
          '<div class="field"><label for="pSubject">제목</label><input class="input" id="pSubject" placeholder="예: [쿠팡] 주문이 완료되었습니다" /></div>' +
          '<div class="field"><label for="pDate">주문일 (선택)</label><input class="input" id="pDate" placeholder="예: 2026-11-18" inputmode="numeric" /></div>' +
          '<div class="field"><label for="pBody">본문</label><textarea class="textarea" id="pBody" style="min-height:150px" placeholder="상품명과 결제금액이 포함된 메일 본문"></textarea></div>' +
          '<div class="note">주문번호·상품명·금액을 함께 붙이면 인식률이 올라갑니다. 광고·리뷰 메일은 자동으로 걸러냅니다.</div>';
      },
      footer: '<button class="btn btn-ghost" data-act="close">닫기</button><button class="btn btn-primary" data-act="ok">해석해서 추가</button>',
      onAction: function (act, btn, sheet) {
        if (act === "close") { sheet.close(); return; }
        var subj = (document.getElementById("pSubject") || {}).value || "";
        var date = (document.getElementById("pDate") || {}).value || "";
        var body = (document.getElementById("pBody") || {}).value || "";
        if (!body.trim()) { LC.toast("본문을 붙여넣어 주세요"); return; }
        var r = CORE.parseMail({ subject: subj, date: date, body: body, from: "" })
          .filter(function (o) { return o.date || date; })
          .map(function (o) { return Object.assign(o, { date: o.date || date, source: "paste" }); });
        if (!r.length) {
          // 제목 없이 본문만 붙인 경우: 광고·안내 판정 없이 상품명+금액 줄을 그대로 읽는다.
          var mall = CORE.detectMall(body, "");
          r = CORE.parseItems(body).map(function (o) {
            return Object.assign(o, { mall: mall, date: o.date || date || LC.today(), source: "paste" });
          });
        }
        if (!r.length) { LC.toast("상품을 찾지 못했습니다. 상품명과 금액을 확인해 주세요"); return; }
        snapshot("붙여넣기 전");
        merge(r, null, false);
        sheet.close();
        setTab("shop");
        LC.toast(LC.num(r.length) + "개 상품을 추가했습니다");
      }
    });
    return s;
  }

  function exportJson() {
    var d = Object.assign({}, store, { exportedAt: new Date().toISOString() });
    var blob = new Blob([JSON.stringify(d, null, 1)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "letscart-backup.json";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    LC.toast("백업 파일을 내려받았습니다");
  }
  function openRestore() {
    var list = snapshots();
    LC.sheet({
      title: "자동 백업에서 되돌리기",
      subtitle: "삭제·덮어쓰기 전 상태를 최근 5개까지 보관합니다",
      render: function (b) {
        b.innerHTML = list.length ? '<div class="mini-list">' + list.map(function (s, i) {
          return '<button class="mini" data-i="' + i + '"><span><span class="mini-t">' + LC.date(s.at) + " " + String(s.at).slice(11, 16) + "</span>" +
            '<span class="mini-s">' + LC.esc(s.reason || "") + " · " + LC.num((s.store.orders || []).length) + "건</span></span>" +
            '<span class="mini-v">복원</span></button>';
        }).join("") + "</div>" : '<div class="notice">아직 자동 백업이 없습니다. 가져오기·삭제 전에 자동으로 만들어집니다.</div>';
      },
      footer: '<button class="btn btn-ghost" data-act="close">닫기</button>',
      onAction: function (act, btn, sheet) { if (act === "close") sheet.close(); }
    });
    setTimeout(function () {
      document.querySelectorAll(".sheet [data-i]").forEach(function (b) {
        b.addEventListener("click", function () {
          var s = list[+b.dataset.i];
          if (!s) return;
          snapshot("복원 전");
          store = Object.assign(blank(), s.store);
          saveStore();
          state.demo = false;
          var sheet = document.querySelector(".sheet");
          if (sheet) { var x = sheet.querySelector(".sheet-close"); if (x) x.click(); }
          refreshAll();
          LC.toast("백업 상태로 되돌렸습니다");
        });
      });
    }, 30);
  }
  function openReset() {
    LC.sheet({
      title: "모두 지울까요?",
      subtitle: "지우기 전 상태를 자동 백업에 남깁니다",
      render: function (b) {
        b.innerHTML = '<div class="note">이 브라우저에 저장된 구매 기록 ' + LC.num(store.orders.length) +
          "건과 가격 추이 " + LC.num(Object.keys(store.prices || {}).length) + "개 품목을 지웁니다. 서버에는 아무것도 없으므로 되돌리려면 자동 백업을 써야 합니다.</div>" +
          '<div style="display:flex;gap:8px;margin-top:14px"><button class="btn btn-ghost" data-act="close" style="flex:1">취소</button>' +
          '<button class="btn btn-primary" data-act="wipe" style="flex:1;background:var(--c-red)">지우기</button></div>';
      }
    });
    setTimeout(function () {
      document.querySelectorAll(".sheet [data-act]").forEach(function (b) {
        b.addEventListener("click", function () {
          if (b.dataset.act === "wipe") {
            snapshot("지우기 전");
            store = blank();
            saveStore();
            state.demo = false;
            refreshAll();
            LC.toast("지웠습니다 · 자동 백업에서 되돌릴 수 있습니다");
          }
          var sheet = document.querySelector(".sheet");
          if (sheet) { var x = sheet.querySelector(".sheet-close"); if (x) x.click(); }
        });
      });
    }, 30);
  }

  /* ------------------------------------------------------------ tabs */
  function setTab(t) {
    state.tab = t;
    document.querySelectorAll(".tab").forEach(function (x) {
      x.setAttribute("aria-selected", x.dataset.tab === t ? "true" : "false");
    });
    ["shop", "spend", "records", "setup"].forEach(function (v) {
      var el = $("view-" + v);
      if (el) el.hidden = v !== t;
    });
    if (t === "shop") renderShop();
    if (t === "spend") renderSpend();
    if (t === "records") renderRecords();
    if (t === "setup") { renderSetup(); renderExt(); }
  }
  function renderSetup() {
    renderStart();
    renderExt();
  }

  function refreshAll() {
    build();
    renderChrome();
    renderStart();
    if (state.tab === "shop") renderShop();
    if (state.tab === "spend") renderSpend();
    if (state.tab === "records") renderRecords();
    if (state.tab === "setup") renderSetup();
  }

  /* ------------------------------------------------------------ wire */
  function wire() {
    LC.paintIcons(document);
    document.querySelectorAll(".tab").forEach(function (t) {
      t.addEventListener("click", function () { setTab(t.dataset.tab); });
    });

    var drop = $("drop");
    drop.addEventListener("click", function () { $("fileEml").click(); });
    drop.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("fileEml").click(); }
    });
    $("fileEml").addEventListener("change", function (e) { emlFiles(e.target.files); e.target.value = ""; });
    ["dragenter", "dragover"].forEach(function (ev) {
      document.addEventListener(ev, function (e) {
        if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") < 0) return;
        e.preventDefault();
        drop.classList.add("dragging");
      });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      document.addEventListener(ev, function (e) {
        if (!e.dataTransfer) return;
        if (ev === "drop") {
          e.preventDefault();
          var fs = e.dataTransfer.files;
          if (fs && fs.length) {
            var eml = Array.prototype.filter.call(fs, function (f) { return /\.eml$/i.test(f.name); });
            var json = Array.prototype.filter.call(fs, function (f) { return /\.json$/i.test(f.name); });
            if (eml.length) emlFiles(eml);
            else if (json.length) jsonFile(json[0]);
            else LC.toast(".eml 또는 백업 JSON만 읽을 수 있습니다");
          }
        }
        drop.classList.remove("dragging");
      });
    });

    $("btnPaste").addEventListener("click", openPaste);
    $("btnJson").addEventListener("click", function () { $("fileJson").click(); });
    $("btnImport").addEventListener("click", function () { $("fileJson").click(); });
    $("fileJson").addEventListener("change", function (e) {
      if (e.target.files && e.target.files[0]) jsonFile(e.target.files[0]);
      e.target.value = "";
    });
    $("btnExport").addEventListener("click", exportJson);
    $("btnRestore").addEventListener("click", openRestore);
    $("btnReset").addEventListener("click", openReset);
    $("btnDemo").addEventListener("click", function () {
      state.demo = true;
      state.shop.cat = null;
      state.shop.view = "rep";
      state.shop.shown = PAGE;
      refreshAll();
      setTab("shop");
      LC.toast("데모 데이터(가상)로 보는 중입니다");
    });

    var catChips = $("shopCats");
    LC.chipGroup(catChips, function () {
      var v = LC.chipValues(catChips)[0] || "";
      state.shop.cat = v || null;
      state.shop.shown = PAGE;
      renderShop();
    });

    LC.dropdown($("shopSort"), function (v) { state.shop.sort = v; renderShop(); });
    var sv = $("shopView");
    sv.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      sv.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      state.shop.view = b.dataset.value;
      state.shop.shown = PAGE;
      renderShop();
    });
    $("shopMore").addEventListener("click", function (e) {
      if (e.target.closest("[data-more]")) { state.shop.shown += PAGE; renderShop(); }
    });
    $("shopGrid").addEventListener("click", function (e) {
      var c = e.target.closest(".scard");
      if (!c) return;
      var all = analysis || build();
      var p = all.find(function (x) { return x.key === c.dataset.key; });
      if (p) openDetail(p);
    });

    var sm = $("spendMode");
    sm.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      sm.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      state.spend.mode = b.dataset.value;
      renderSpend();
    });

    var rf = $("rFilter");
    rf.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      rf.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      state.records.filter = b.dataset.value;
      state.records.shown = 40;
      renderRecords();
    });
    var q = $("rQ");
    var run = LC.debounce(function () {
      state.records.q = q.value.trim();
      state.records.shown = 40;
      renderRecords();
    }, 180);
    q.addEventListener("input", function () {
      $("rSearchBox").classList.toggle("has-value", !!q.value);
      run();
    });
    $("rQClear").addEventListener("click", function () {
      q.value = "";
      $("rSearchBox").classList.remove("has-value");
      state.records.q = "";
      renderRecords();
      q.focus();
    });
    $("rMore").addEventListener("click", function (e) {
      if (e.target.closest("[data-more]")) { state.records.shown += 40; renderRecords(); }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && document.activeElement && document.activeElement.classList.contains("scard")) {
        document.activeElement.click();
      }
    });
  }

  /* ------------------------------------------------------------ boot */
  try {
    build();
    wire();
    renderChrome();
    renderStart();
    renderExt();
    setTab("shop");
    if (store.orders.length) LC.toast("이 브라우저에 저장된 기록 " + LC.num(store.orders.length) + "건으로 시작합니다");
  } catch (e) {
    var g = $("shopGrid");
    if (g) g.innerHTML = '<div class="empty" style="grid-column:1/-1"><h3>화면을 그리지 못했습니다</h3><p>' + LC.esc(e && e.message) + "</p></div>";
  }

  // 테스트(v15)가 확인하는 이름들
  window.LetsCartLocal = { versionAtLeast: versionAtLeast, REQUIRED_EXTENSION_VERSION: REQUIRED_EXTENSION_VERSION, state: state, refreshAll: refreshAll };
})();
