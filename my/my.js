/* /my — 내 지출·재구매 허브 (Cloudflare Access 인증 필요) */
(function () {
  "use strict";
  var LC = window.LC;
  var API = "/api/private/";
  var MEDIA = "https://letscart.pages.dev/media/";
  var CORE = window.LetsCartCore || window.LetsBuy;
  var INS = window.LetsCartInsights || window.LetsBuyInsights;
  var ACT = window.LetsCartAction || null;
  var TODAY = LC.today();

  var state = {
    summary: null,
    tab: "dash",
    orders: { q: "", market: "", match: "all", period: "", limit: 30, offset: 0, total: 0, rows: [], loading: false },
    ledger: { q: "", market: "", match: "all", limit: 40, offset: 0, total: 0, rows: [], loading: false },
    rebuy: null,
    split: true,
    rivals: null,
    cmp: null,
    cmpPending: null
  };

  var $ = function (id) { return document.getElementById(id); };

  var MARKET_FALLBACK = {
    coupang: "쿠팡", kurly: "컬리", gmarket: "지마켓", naver: "네이버쇼핑", "11st": "11번가",
    aliexpress: "알리익스프레스", lotteon: "롯데온", ohou: "오늘의집", temu: "테무", gsshop: "GS SHOP",
    ssg: "SSG닷컴", amazon: "아마존", malltail: "몰테일", auction: "옥션", wemakeprice: "위메프",
    tmon: "티몬", interpark: "인터파크", emart: "이마트몰", homeplus: "홈플러스", lotte_hs: "롯데홈쇼핑"
  };
  function marketName(code) {
    var ms = (state.summary && state.summary.markets) || [];
    for (var i = 0; i < ms.length; i++) if (ms[i].code === code) return ms[i].name;
    return MARKET_FALLBACK[code] || code || "–";
  }

  /* --------------------------------------------- 행동 판정 · 단위가격 엔진 */
  function profileOf(name) { return CORE.itemProfile(String(name || "")); }
  function isNonSpend(name) {
    var p = profileOf(name);
    return p.includeSpend === false || p.entity === "stored_value" || p.entity === "digital" || p.entity === "service";
  }
  function actOf(r) {
    if (!ACT) return null;
    var item = {
      key: String(r.id), name: r.danawaName || r.label,
      ref: r.avg ? { price: r.avg, label: "평균 구매가" } : null,
      last: r.last, now: r.now ? { date: TODAY, price: r.now, src: "다나와", title: r.danawaName || r.label } : null,
      count: r.buys || 0, cycleDays: r.cycle, daysLeft: r.daysLeft, img: null
    };
    var a = null;
    try { a = ACT.judge(item, TODAY); } catch (e) { a = null; }
    return a;
  }
  function actBadge(a, big) {
    if (!a || !a.meta) return "";
    return '<span class="act ' + a.meta.cls + (big ? " act-lg" : "") + '">' + LC.esc(a.meta.label) + "</span>";
  }
  function unitOf(r) {
    if (!INS || !INS.unitPrice) return null;
    var price = r.avg || r.min || r.now;
    if (!price) return null;
    return INS.unitPrice(r.danawaName || r.label, price, 1);
  }
  function shrinkOf(r) {
    if (!ACT || !ACT.shrinkOf || !r.danawaName) return null;
    return ACT.shrinkOf(r.label, r.danawaName);
  }

  function splitRows(rows) {
    if (!state.split) return rows;
    return rows.filter(function (r) { return !isNonSpend(r.danawaName || r.label); });
  }

  function renderActPanel() {
    var d = state.rebuy;
    var box = $("actSummary");
    if (!box) return;
    if (!d) { box.innerHTML = '<div class="notice">재구매 알림을 불러오는 중…</div>'; return; }
    var rows = splitRows(d.rows || []);
    var by = { buy: [], soon: [], due: [], wait: [], ok: [] };
    rows.forEach(function (r) {
      var a = actOf(r);
      if (!a) return;
      (by[a.verdict.k] || by.ok).push({ r: r, a: a });
    });
    $("actHint").textContent = LC.num(rows.length) === LC.num((d.rows || []).length)
      ? LC.num(rows.length) + "개 상품군"
      : LC.num(rows.length) + " / " + LC.num((d.rows || []).length) + "개 (정산·디지털 분리)";
    var order = ["buy", "soon", "due", "wait"];
    var labels = { buy: "지금 사세요", soon: "곧 떨어져요", due: "살 때 됐어요", wait: "기다리세요" };
    var tone = { buy: "var(--c-green-text)", soon: "#1b64da", due: "var(--c-red-text)", wait: "var(--c-amber-text)" };
    var top = [];
    order.forEach(function (k) {
      (by[k] || []).slice().sort(function (a, b) { return a.a.daysLeft - b.a.daysLeft; }).forEach(function (x) { top.push(x); });
    });
    box.innerHTML =
      '<div class="statline" style="gap:14px;font-size:12px;margin-bottom:8px">' + order.map(function (k) {
        return "<span>" + labels[k] + " <b style=\"color:" + tone[k] + "\">" + (by[k] || []).length + "</b></span>";
      }).join("") + "</div>" +
      (top.length ? '<div class="mini-list">' + top.slice(0, 6).map(function (x) {
        return '<button class="mini" data-actrow="' + LC.esc(String(x.r.id)) + '"><span><span class="mini-t">' + LC.text(x.r.label) +
          '</span><span class="mini-s">주기 ' + (x.r.cycle ? Math.round(x.r.cycle) + "일" : "–") + " · 다음 " + LC.date(x.r.next) +
          (x.a.unit ? " · " + LC.esc(x.a.unit.label) + " " + LC.won(x.a.unit.value) : "") + "</span></span>" +
          actBadge(x.a) + "</button>";
      }).join("") + "</div>" : '<div class="notice">판정할 재구매 상품군이 없습니다.</div>');
    box.querySelectorAll("[data-actrow]").forEach(function (b) {
      b.addEventListener("click", function () {
        var r = (d.rows || []).find(function (x) { return String(x.id) === b.dataset.actrow; });
        if (r) openRebuy(r);
      });
    });
  }

  function renderUnitPanel() {
    var box = $("unitPanel");
    if (!box) return;
    var d = state.rebuy;
    if (!d) { box.innerHTML = '<div class="notice">불러오는 중…</div>'; return; }
    var rows = splitRows(d.rows || []);
    var units = [];
    var shrinks = [];
    rows.forEach(function (r) {
      var u = unitOf(r);
      if (u) units.push({ r: r, u: u });
      var sh = shrinkOf(r);
      if (sh) shrinks.push({ r: r, sh: sh });
    });
    units.sort(function (a, b) { return a.u.value - b.u.value; });
    box.innerHTML =
      (shrinks.length ? '<div class="notice" style="margin-bottom:8px"><b>슈링크플레이션 ' + shrinks.length + "건</b> — " +
        shrinks.slice(0, 2).map(function (x) { return LC.text(x.r.label) + " 용량 −" + x.sh.pct + "%"; }).join(", ") + "</div>" : "") +
      (units.length ? '<div class="mini-list">' + units.slice(0, 8).map(function (x) {
        return '<div class="mini"><span><span class="mini-t">' + LC.text(x.r.label) + "</span>" +
          '<span class="mini-s">평균 ' + LC.won(x.r.avg) + " · " + LC.esc(x.u.label) + "</span></span>" +
          '<span class="mini-v tnum">' + LC.won(x.u.value) + "</span></div>";
      }).join("") + "</div>" : '<div class="notice">단위가격을 계산할 수 있는 품목이 없습니다(상품명에 용량·개수가 필요).</div>') +
      '<div class="notice" style="margin-top:8px">단위가격은 평균 구매가 기준입니다. 슈링크플레이션은 다나와에 지금 등록된 규격과 내가 산 상품명의 용량을 비교합니다.</div>';
  }

  function wireSplit(id, render) {
    var el = $(id);
    if (!el || el.dataset.bound) return;
    el.dataset.bound = "1";
    el.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      el.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      state.split = b.dataset.value === "split";
      ["dashSplit", "rebuySplit"].forEach(function (other) {
        var o = $(other);
        if (!o || o === el) return;
        o.querySelectorAll("button").forEach(function (x) {
          x.setAttribute("aria-pressed", (x.dataset.value === "split") === state.split ? "true" : "false");
        });
      });
      renderActPanel();
      renderUnitPanel();
      render();
    });
  }

  /* ------------------------------------------------------------- gate */
  function gate(title, msg, extra) {
    $("app").hidden = true;
    var g = $("gate");
    g.hidden = false;
    g.innerHTML = '<div class="gate"><div class="ico">' + LC.icon("lock", "icon-lg") + "</div>" +
      "<h2>" + LC.esc(title) + "</h2><p>" + msg + "</p>" + (extra || "") + "</div>";
    LC.paintIcons(g);
  }

  function api(path, params) {
    var u = new URL(API + path, location.origin);
    Object.keys(params || {}).forEach(function (k) {
      if (params[k] !== "" && params[k] !== null && params[k] !== undefined) u.searchParams.set(k, params[k]);
    });
    return fetch(u.toString(), { credentials: "include", headers: { "Accept": "application/json" } })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) {
          var e = new Error("access");
          e.code = r.status;
          throw e;
        }
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
  }

  /* ------------------------------------------------------------- init */
  if (/\.github\.io$/.test(location.hostname)) {
    gate("개인 영역은 letscart.pages.dev 에서",
      "가계부·주문·재구매 정보는 개인 데이터라 Cloudflare Access(이메일 인증) 뒤에 두었습니다. " +
      "GitHub Pages 공개 사이트에는 어떤 개인 데이터도 포함되지 않습니다.",
      '<a class="btn btn-primary" href="https://letscart.pages.dev/my">letscart.pages.dev/my 열기</a>' +
      '<a class="btn btn-ghost" href="../" style="margin-left:8px">공개 카탈로그</a>');
    return;
  }

  api("summary", {})
    .then(function (d) {
      state.summary = d;
      $("gate").hidden = true;
      $("app").hidden = false;
      $("whoEmail").textContent = d.identity || "인증됨";
      LC.paintIcons(document);
      renderKpis(d);
      renderDash(d);
      bindAll();
      bootRivals();
    })
    .catch(function (e) {
      if (e.code) {
        gate("Cloudflare Access 로그인이 필요합니다",
          "이 화면은 가계부·주문·재구매 데이터를 다룹니다. 허용된 가족 계정으로 로그인하면 바로 열립니다.",
          '<a class="btn btn-primary" href="/my">다시 시도</a>' +
          '<a class="btn btn-ghost" href="../" style="margin-left:8px">공개 카탈로그</a>');
      } else {
        gate("데이터를 불러오지 못했습니다", LC.esc(e.message) + " — 잠시 후 다시 시도해 주세요.",
          '<button class="btn btn-primary" onclick="location.reload()">새로고침</button>');
      }
    });

  /* ------------------------------------------------------------- kpis */
  function renderKpis(d) {
    var t = d.totals;
    var cells = [
      { k: "온라인 지출 합계", v: LC.num(t.ledgerTotal) + "<small>원</small>", s: LC.num(t.ledgerRows) + "행 · " + LC.date(t.firstLedger) + "~", cls: "kpi-accent" },
      { k: "실주문", v: LC.num(t.orders) + "<small>건</small>", s: LC.num(t.items) + "라인 · " + LC.num(t.orderTotal) + "원" },
      { k: "가계부 ↔ 주문 대조", v: t.matchPct + "<small>%</small>", s: LC.num(t.matched) + " / " + LC.num(t.ledgerRows) + "행" },
      { k: "재구매 상품군", v: LC.num(t.rebuy) + "<small>개</small>", s: "도래·임박 " + t.dueSoon + " · 장기 미구매 " + (t.overdue || 0) }
    ];
    $("kpis").innerHTML = cells.map(function (c) {
      return '<div class="kpi ' + (c.cls || "") + '"><div class="kpi-k">' + c.k + '</div>' +
        '<div class="kpi-v tnum">' + c.v + '</div><div class="kpi-s">' + c.s + "</div></div>";
    }).join("");
    $("nOrders").textContent = LC.num(t.orders);
    $("nLedger").textContent = LC.num(t.ledgerRows);
    $("nRebuy").textContent = LC.num(t.rebuy);
  }

  function renderDash(d) {
    var max = Math.max.apply(null, d.markets.map(function (m) { return m.ledgerTotal || 0; }).concat([1]));
    $("ledgerSpan").textContent = LC.date(d.totals.firstLedger) + " ~ " + LC.date(d.totals.lastLedger);
    var act = d.markets.filter(function (m) { return m.ledgerTotal > 0 || m.orders > 0; });
    var top = act.slice(0, 10);
    var rest = act.slice(10);
    var restTotal = rest.reduce(function (s, m) { return s + (m.ledgerTotal || 0); }, 0);
    var restOrders = rest.reduce(function (s, m) { return s + (m.orders || 0); }, 0);
    $("bars").innerHTML = top.map(function (m) {
      var w = Math.max(2, Math.round((m.ledgerTotal / max) * 100));
      return '<div class="bar-row"><div class="bar-name"><i style="width:7px;height:7px;border-radius:50%;background:' +
        m.color + ';display:inline-block;flex:none"></i><span>' + LC.esc(m.name) + "</span></div>" +
        '<div class="bar-track"><div class="bar-fill" style="width:' + w + "%;background:" + m.color + '"></div></div>' +
        '<div class="bar-val tnum">' + LC.compact(m.ledgerTotal) + "원<small>주문 " + m.orders + " · 대조 " + m.matchPct + "%</small></div></div>";
    }).join("") + (rest.length
      ? '<div class="notice" style="margin-top:8px">그 외 ' + rest.length + "개 마켓 · " + LC.compact(restTotal) +
        "원 · 주문 " + LC.num(restOrders) + "건</div>" : "")
      || '<div class="notice">표시할 지출이 없습니다.</div>';

    var savingsRows = state.split ? d.savings.filter(function (s) { return !isNonSpend(s.label); }) : d.savings;
    var dueRows = state.split ? d.due.filter(function (r) { return !isNonSpend(r.label); }) : d.due;
    $("savings").innerHTML = savingsRows.length
      ? '<div class="mini-list">' + savingsRows.map(function (s) {
        return '<button class="mini" data-saving="' + LC.esc(s.label) + '"><span><span class="mini-t">' + LC.esc(s.label) +
          '</span><span class="mini-s">평균 ' + LC.num(s.avg_price_krw) + "원 → 최저 " + LC.num(s.min_price_krw) +
          "원</span></span><span class=\"mini-v\" style=\"color:var(--c-green-text)\">−" + s.saving_pct + "%</span></button>";
      }).join("") + "</div>"
      : '<div class="notice">절감 여지가 계산된 상품이 없습니다.</div>';

    $("dueList").innerHTML = dueRows.length
      ? '<div class="mini-list">' + dueRows.map(function (r) {
        var dd = r.days_left;
        var cls = dd <= 0 ? "badge-red" : dd <= 14 ? "badge-amber" : "badge-blue";
        return '<button class="mini" data-due="' + LC.text(r.label) + '"><span><span class="mini-t">' + LC.text(r.label) +
          '</span><span class="mini-s">주기 ' + (r.avg_cycle_days ? Math.round(r.avg_cycle_days) + "일" : "–") +
          " · 다음 " + LC.date(r.next_expected) + '</span></span><span class="badge ' + cls + '">' +
          (dd === 0 ? "오늘" : dd < 0 ? "D+" + Math.abs(dd) : "D-" + dd) + "</span></button>";
      }).join("") + "</div>"
      : '<div class="notice">21일 내 도래하는 재구매가 없습니다.</div>' +
        (d.totals.overdue ? '<div class="notice" style="margin-top:6px">주기가 한참 지난 상품 ' + d.totals.overdue + "개는 [재구매] 탭에서 볼 수 있습니다.</div>" : "") +
        (state.split ? '<div class="notice" style="margin-top:6px">정산·결제·디지털 항목은 분리해 뺐습니다. “전체”로 바꾸면 함께 보입니다.</div>' : "");

    $("collection").innerHTML = '<div class="mini-list">' + d.collection.map(function (c) {
      var badge = c.result === "collected" ? "badge-green" : c.result === "empty" ? "badge-amber" : "badge-red";
      var label = { collected: "수집", empty: "0건", path_not_found: "경로 없음", not_attempted: "미시도", login_required: "로그인 필요" }[c.result] || c.result;
      return '<div class="mini" style="grid-template-columns:minmax(0,1fr) auto"><span><span class="mini-t">' + LC.esc(c.name || c.market_code) +
        '</span><span class="mini-s">' + LC.esc((c.limit_note || "").slice(0, 60)) + '</span></span>' +
        '<span class="badge ' + badge + '">' + label + " " + (c.orders_found || 0) + "</span></div>";
    }).join("") + "</div>";

    ensureRebuy();
    renderActPanel();
    renderUnitPanel();
  }

  /* ------------------------------------------------------------- bind */

  /* ------------------------------------------------------------- 라이벌 비교 */
  var LCV = window.LetsCartRivals;

  function loadCompare() {
    if (state.cmp) return Promise.resolve(state.cmp);
    if (state.cmpPending) return state.cmpPending;
    state.cmpPending = api("compare", {}).then(function (d) {
      state.cmp = {};
      (d.groups || []).forEach(function (g) { state.cmp[g.id] = g.orders || []; });
      return state.cmp;
    }).catch(function () { state.cmp = {}; return state.cmp; });
    return state.cmpPending;
  }
  function ordersOf(g) {
    var rows = (state.cmp && state.cmp[g.id]) || [];
    return rows.map(function (x) {
      return { date: x.date, name: x.name, price: x.price, qty: x.qty || 1, mall: marketName(x.mall) || x.mall };
    });
  }
  function bootRivals() {
    if (!LCV) return;
    Promise.all([LCV.load(), loadCompare()]).then(function (r) {
      state.rivals = r[0].groups || [];
      renderRhythm();
      renderMyRivals();
      renderRivalGrid();
      ensureRebuy().then(function () { renderRhythm(); renderDueBoard(); }).catch(function () {});
    }).catch(function () {});
  }

  function rhythmStats() {
    var rows = state.rebuy ? state.rebuy.rows : [];
    if (state.split) rows = rows.filter(function (r) { return !isNonSpend(r.danawaName || r.label); });
    var buy = 0, due = 0, soon = 0, wait = 0, saving = 0, shrink = 0;
    rows.forEach(function (r) {
      var a = actOf(r);
      if (a && a.meta) {
        if (a.meta.k === "buy" || a.k === "buy") buy++;
        else if (a.meta.k === "due" || a.k === "due") due++;
        else if (a.meta.k === "wait" || a.k === "wait") wait++;
        else if (a.meta.k === "soon" || a.k === "soon") soon++;
      }
      var dleft = r.daysLeft;
      if (dleft != null && dleft >= -30 && dleft <= 14 && r.saving > 0) saving += r.saving;
      var sh = shrinkOf(r);
      if (sh && sh.pct > 0) shrink++;
    });
    return { buy: buy, due: due, soon: soon, wait: wait, saving: saving, shrink: shrink, total: rows.length };
  }

  function renderRhythm() {
    var box = $("rhythm");
    if (!box) return;
    var st = rhythmStats();
    var when = st.due + st.buy + st.soon;
    box.innerHTML = '<div class="rhythm-card">' +
      '<div class="rhythm-main">' +
        '<div class="rhythm-k">' + LC.icon("clock", "icon-sm") + ' 이번 달 살 때 온 품목</div>' +
        '<div class="rhythm-v tnum">' + when + '<small>개</small></div>' +
        '<div class="rhythm-lanes">' +
          '<span class="lane buy">지금 사세요 <b>' + st.buy + '</b></span>' +
          '<span class="lane due">살 때 됐어요 <b>' + st.due + '</b></span>' +
          '<span class="lane wait">기다리세요 <b>' + st.wait + '</b></span>' +
        '</div>' +
      '</div>' +
      '<div class="rhythm-stats">' +
        '<div class="rs"><span>절감 가능액</span><b class="tnum">' + LC.won(st.saving) + '</b><em>도래·임박 품목 기준</em></div>' +
        '<div class="rs"><span>슈링크 주의</span><b class="tnum">' + st.shrink + '건</b><em>같은 값, 줄어든 용량</em></div>' +
        '<div class="rs"><span>추적 품목</span><b class="tnum">' + st.total + '개</b><em>' + (state.split ? "정산·디지털 분리 적용" : "전체 표시") + '</em></div>' +
      '</div>' +
    '</div>';
  }

  function renderDueBoard() {
    var box = $("dueBoard");
    if (!box || !state.rebuy) return;
    var rows = state.rebuy.rows.slice();
    if (state.split) rows = rows.filter(function (r) { return !isNonSpend(r.danawaName || r.label); });
    var lane = { buy: [], due: [], wait: [], soon: [] };
    rows.forEach(function (r) {
      var a = actOf(r);
      var k = a && (a.k || (a.meta && a.meta.k));
      if (!k) return;
      if (r.daysLeft != null && r.daysLeft > 21) return;
      if (lane[k]) lane[k].push({ r: r, a: a });
    });
    var def = [
      { k: "buy", t: "지금 사세요", d: "내 평균가보다 확실히 낮음" },
      { k: "due", t: "살 때 됐어요", d: "구매주기도 왔고 값도 평소" },
      { k: "wait", t: "기다리세요", d: "지금은 평균보다 높음" }
    ];
    box.innerHTML = '<div class="lanes">' + def.map(function (x) {
      var list = lane[x.k].sort(function (a, b) { return (a.r.daysLeft || 0) - (b.r.daysLeft || 0); }).slice(0, 4);
      return '<div class="lane-col"><div class="lane-head"><span class="act ' + (x.k === "buy" ? "act-buy" : x.k === "due" ? "act-due" : "act-wait") + '">' + x.t + '</span>' +
        '<b class="tnum">' + lane[x.k].length + '</b></div><div class="lane-sub">' + x.d + '</div>' +
        (list.length ? list.map(function (o) {
          var r = o.r;
          var delta = r.avg && r.now ? Math.round((r.now - r.avg) / r.avg * 100) : null;
          return '<button type="button" class="lane-row" data-rebuy="' + LC.esc(r.id) + '">' +
            '<span class="lane-name">' + LC.text(r.label) + '</span>' +
            '<span class="lane-meta">' + (r.daysLeft != null ? (r.daysLeft <= 0 ? "D+" + Math.abs(r.daysLeft) + " 도래" : "D-" + r.daysLeft) : "") +
            (delta != null ? " · " + (delta <= 0 ? "" : "+") + delta + "%" : "") + '</span></button>';
        }).join("") : '<div class="lane-empty">해당 없음</div>') + "</div>";
    }).join("") + "</div>";
    box.querySelectorAll("[data-rebuy]").forEach(function (b) {
      b.addEventListener("click", function () {
        var r = state.rebuy.rows.filter(function (x) { return String(x.id) === b.dataset.rebuy; })[0];
        if (r) openRebuy(r);
      });
    });
  }

  function renderMyRivals() {
    var box = $("myRivals");
    if (!box || !state.rivals || !LCV) return;
    var list = state.rivals.map(function (g) { return { g: g, my: LCV.myStats(ordersOf(g), g) }; });
    list.sort(function (a, b) { return (b.my.buys || 0) - (a.my.buys || 0); });
    var withMine = list.filter(function (x) { return x.my.buys > 0; });
    $("myRivalsHint").textContent = "내 기록 있는 " + withMine.length + "품목 · 다나와 " + (state.rivals[0] ? state.rivals[0].observedAt : "");
    var show = list.slice(0, 8);
    box.innerHTML = '<div class="rv-grid-8">' + show.map(function (x) { return LCV.tile(x.g, x.my); }).join("") + "</div>";
    box.querySelectorAll("[data-rv-open]").forEach(function (b) {
      b.addEventListener("click", function () {
        var it = show.filter(function (x) { return x.g.id === b.dataset.rvOpen; })[0];
        if (it) LCV.open(it.g, it.my);
      });
    });
  }

  function renderRivalGrid() {
    var box = $("rivalGrid");
    if (!box || !state.rivals || !LCV) return;
    var list = state.rivals.map(function (g) { return { g: g, my: LCV.myStats(ordersOf(g), g) }; });
    list.sort(function (a, b) { return (b.my.buys || 0) - (a.my.buys || 0); });
    $("rivalGridHint").textContent = list.length + "품목 · 내 기록 " +
      list.filter(function (x) { return x.my.buys; }).length + "품목";
    box.innerHTML = list.map(function (x) { return LCV.tile(x.g, x.my); }).join("");
    box.querySelectorAll("[data-rv-open]").forEach(function (b) {
      b.addEventListener("click", function () {
        var it = list.filter(function (x) { return x.g.id === b.dataset.rvOpen; })[0];
        if (it) LCV.open(it.g, it.my);
      });
    });
  }

  function bindAll() {
    wireSplit("dashSplit", function () { renderDash(state.summary); });
    wireSplit("rebuySplit", function () { if (state.rebuy) renderRebuy(state.rebuy); });
    document.querySelectorAll(".tab").forEach(function (t) {
      t.addEventListener("click", function () {
        var tab = t.dataset.tab;
        if (tab === state.tab) return;
        state.tab = tab;
        document.querySelectorAll(".tab").forEach(function (x) {
          x.setAttribute("aria-selected", x === t ? "true" : "false");
        });
        ["dash", "rivals", "orders", "ledger", "rebuy"].forEach(function (v) {
          $("view-" + v).hidden = v !== tab;
        });
        if (tab === "rivals") renderRivalGrid();
        if (tab === "orders" && !state.orders.rows.length) initOrders();
        if (tab === "ledger" && !state.ledger.rows.length) initLedger();
        // 재구매 데이터는 대시보드에서 먼저 받아 두므로, 탭을 열 때는 그려 주기만 하면 된다.
        if (tab === "rebuy") { if (state.rebuy) renderRebuy(state.rebuy); else initRebuy(); }
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    bindSearch("oQ", "oSearchBox", "oQClear", function (v) {
      state.orders.q = v; state.orders.offset = 0; state.orders.rows = []; loadOrders(true);
    });
    bindSearch("lQ", "lSearchBox", "lQClear", function (v) {
      state.ledger.q = v; state.ledger.offset = 0; state.ledger.rows = []; loadLedger(true);
    });

    ["oMatch", "oPeriod", "lMatch"].forEach(function (id) {
      var el = $(id);
      el.addEventListener("click", function (e) {
        var b = e.target.closest("button");
        if (!b) return;
        el.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        if (id === "oMatch") { state.orders.match = b.dataset.value; state.orders.rows = []; state.orders.offset = 0; loadOrders(true); }
        if (id === "oPeriod") { state.orders.period = b.dataset.value; state.orders.rows = []; state.orders.offset = 0; loadOrders(true); }
        if (id === "lMatch") { state.ledger.match = b.dataset.value; state.ledger.rows = []; state.ledger.offset = 0; loadLedger(true); }
      });
    });

    $("oMore").addEventListener("click", function (e) {
      if (e.target.closest("[data-more]")) { state.orders.offset += state.orders.limit; loadOrders(false); }
    });
    $("lMore").addEventListener("click", function (e) {
      if (e.target.closest("[data-more]")) { state.ledger.offset += state.ledger.limit; loadLedger(false); }
    });
    var allBtn = $("btnAllRivals");
    if (allBtn) allBtn.addEventListener("click", function () {
      document.querySelector('.tab[data-tab="rivals"]').click();
    });
  }

  function bindSearch(inputId, boxId, clearId, cb) {
    var i = $(inputId), box = $(boxId), c = $(clearId);
    var run = LC.debounce(function () { cb(i.value.trim()); }, 260);
    i.addEventListener("input", function () {
      box.classList.toggle("has-value", !!i.value);
      run();
    });
    c.addEventListener("click", function () {
      i.value = ""; box.classList.remove("has-value"); cb("");
      i.focus();
    });
  }

  /* ------------------------------------------------------------- orders */
  function marketChips(rootId, current, onPick, mode) {
    var d = state.summary;
    var keep = mode === "orders" ? function (m) { return m.orders > 0; }
      : mode === "ledger" ? function (m) { return m.ledgerRows > 0; }
      : function (m) { return m.orders > 0 || m.ledgerTotal > 0; };
    var html = '<button class="chip" data-value="" aria-pressed="' + (!current ? "true" : "false") + '">전체</button>' +
      d.markets.filter(keep).map(function (m) {
        return '<button class="chip" data-value="' + m.code + '" aria-pressed="' + (current === m.code ? "true" : "false") +
          '"><i class="dot" style="--dc:' + m.color + '"></i>' + LC.esc(m.name) +
          ' <span class="count">' + (m.orders || m.ledgerRows) + "</span></button>";
      }).join("");
    var root = $(rootId);
    root.innerHTML = html;
    root.addEventListener("click", function (e) {
      var c = e.target.closest(".chip");
      if (!c) return;
      root.querySelectorAll(".chip").forEach(function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
      onPick(c.dataset.value);
    });
  }

  function initOrders() {
    marketChips("oMarkets", state.orders.market, function (v) {
      state.orders.market = v; state.orders.rows = []; state.orders.offset = 0; loadOrders(true);
    }, "orders");
    loadOrders(true);
  }
  function periodRange(p) {
    if (!p) return ["", ""];
    var to = new Date();
    var from = new Date(to.getTime());
    if (p === "3m") from.setMonth(from.getMonth() - 3);
    if (p === "1y") from.setFullYear(from.getFullYear() - 1);
    if (p === "3y") from.setFullYear(from.getFullYear() - 3);
    var f = function (d) { return d.toISOString().slice(0, 10); };
    return [f(from), f(to)];
  }

  function loadOrders(reset) {
    var s = state.orders;
    if (s.loading) return;
    s.loading = true;
    var range = periodRange(s.period);
    if (reset) $("oList").innerHTML = '<div class="orow"><div class="skel" style="height:34px"></div></div>' +
      '<div class="orow"><div class="skel" style="height:34px"></div></div>';
    $("oCount").textContent = "불러오는 중…";
    api("orders", { q: s.q, market: s.market, match: s.match, from: range[0], to: range[1], limit: s.limit, offset: s.offset })
      .then(function (d) {
        s.total = d.total;
        s.rows = reset ? d.orders : s.rows.concat(d.orders);
        renderOrders();
      })
      .catch(function (e) {
        $("oList").innerHTML = '<div class="empty"><h3>주문을 불러오지 못했습니다</h3><p>' + LC.esc(e.message) + "</p></div>";
      })
      .then(function () { s.loading = false; });
  }

  function renderOrders() {
    var s = state.orders;
    $("oCount").innerHTML = "<b>" + LC.num(s.total) + "</b>건";
    $("oList").innerHTML = s.rows.length ? s.rows.map(function (o, i) {
      var uniq = [];
      o.items.forEach(function (x) { if (uniq.indexOf(x.name) < 0) uniq.push(x.name); });
      var names = uniq.slice(0, 3).join(" · ") + (uniq.length > 3 ? " 외 " + (uniq.length - 3) + "종" : "");
      var dd = o.date ? o.date.slice(5).replace("-", ".") : "";
      return '<button class="orow" data-order="' + i + '"><div class="orow-top">' +
        '<span class="orow-date">' + (o.date || "") + "</span>" +
        '<span class="mk" style="--dc:' + o.color + '"><i></i>' + LC.esc(marketName(o.market)) + "</span>" +
        (o.status ? '<span class="badge">' + LC.esc(o.status) + "</span>" : "") +
        (o.ledger.length ? '<span class="badge badge-green">가계부 대조</span>' : "") +
        "</div><div class=\"orow-right\" style=\"grid-row:span 2\"><div class=\"orow-total tnum\">" + LC.num(o.total) + "원</div>" +
        '<div class="orow-meta">' + (o.lineCount || o.items.length) + "개 항목</div></div>" +
        '<div class="orow-items">' + LC.text(names || "(항목 정보 없음)") + "</div></button>";
    }).join("") : '<div class="empty"><h3>조건에 맞는 주문이 없습니다</h3><p>검색어·마켓·기간을 바꿔 보세요.</p></div>';

    $("oMore").innerHTML = s.rows.length < s.total
      ? '<button class="btn btn-ghost" data-more="1">더 보기 (' + LC.num(s.total - s.rows.length) + "건)</button>" : "";

    $("oList").querySelectorAll("[data-order]").forEach(function (b) {
      b.addEventListener("click", function () { openOrder(s.rows[+b.dataset.order]); });
    });
  }

  function openOrder(o) {
    LC.sheet({
      title: (o.date || "") + " 주문",
      subtitle: LC.num(o.total) + "원 · " + (o.status || "") + (o.detail ? " · " + o.detail : ""),
      render: function (b) {
        var rows = o.items.map(function (i) {
          var specLine = i.product ? (i.product.spec || "") : "";
          var thumb = i.product && i.product.media
            ? '<img src="' + LC.esc(MEDIA + i.product.media) + '" alt="" loading="lazy" />'
            : LC.icon("box", "icon-sm");
          return '<div class="item-row"><div class="item-thumb">' + thumb + "</div><div>" +
            '<div class="item-name">' + LC.text(i.name || "") + "</div>" +
            (i.option ? '<div class="item-spec">옵션: ' + LC.esc(i.option) + "</div>" : "") +
            (i.product ? '<div class="item-spec" style="color:var(--c-text-2)"><b>' + LC.text(i.product.name) + "</b>" +
              (i.product.rating ? " · ★" + Number(i.product.rating).toFixed(1) : "") +
              (i.product.reviews ? " (" + LC.num(i.product.reviews) + ")" : "") + "</div>" : "") +
            (specLine ? '<div class="item-spec">' + LC.text(specLine) + "</div>" : "") +
            (i.product && i.product.url ? '<a href="' + LC.esc(i.product.url) + '" target="_blank" rel="noopener" style="font-size:11.5px;font-weight:700">다나와 스펙 보기</a>' : "") +
            "</div><div><div class=\"item-paid tnum\">" + LC.num(i.paid) + "원</div>" +
            '<div class="orow-meta">' + (i.qty || 1) + "개" + (i.unit ? " · 개당 " + LC.num(i.unit) + "원" : "") + "</div></div></div>";
        }).join("");

        var led = o.ledger.length
          ? '<div class="matched-box"><b>가계부 대조</b><br>' + o.ledger.map(function (l) {
            return LC.date(l.date) + " · " + LC.num(l.amount) + "원 · " + LC.esc(l.item || "") +
              " <span class=\"muted\">(" + (l.method === "single" ? "단일주문" : l.method === "date_total" ? "일별합계" : l.method) +
              (l.dateDelta !== null ? ", ±" + l.dateDelta + "일" : "") + ")</span>";
          }).join("<br>") + "</div>"
          : '<div class="unmatched-box">가계부에서 이 주문을 찾지 못했습니다. 가계부는 결제·묶음 단위로 기록되어 10% 안팎만 대조됩니다.</div>';

        b.innerHTML = '<div class="mk" style="--dc:' + o.color + ';margin-bottom:10px"><i></i>' + LC.esc(marketName(o.market)) +
          " · 주문번호 " + LC.esc(o.no || "") + "</div>" + rows +
          '<div class="section"><div class="section-head"><h3>가계부 대조</h3></div>' + led + "</div>" +
          '<div class="section"><div class="note">당시 구매가는 주문 라인 결제액이고, 스펙·사진은 같은 상품으로 매칭된 다나와 정보입니다. ' +
          "매칭되지 않은 라인은 상품명만 표시됩니다.</div></div>";
      },
      footer: '<button class="btn btn-ghost" data-act="close">닫기</button>'
    }).foot && null;
  }

  /* ------------------------------------------------------------- ledger */
  function initLedger() {
    marketChips("lMarkets", state.ledger.market, function (v) {
      state.ledger.market = v; state.ledger.rows = []; state.ledger.offset = 0; loadLedger(true);
    }, "ledger");
    loadLedger(true);
  }

  function loadLedger(reset) {
    var s = state.ledger;
    if (s.loading) return;
    s.loading = true;
    if (reset) $("lList").innerHTML = '<div class="orow"><div class="skel" style="height:34px"></div></div>';
    $("lCount").textContent = "불러오는 중…";
    api("ledger", { q: s.q, market: s.market, match: s.match, limit: s.limit, offset: s.offset })
      .then(function (d) {
        s.total = d.total;
        s.sum = d.sum;
        s.rows = reset ? d.rows : s.rows.concat(d.rows);
        renderLedger();
      })
      .catch(function (e) {
        $("lList").innerHTML = '<div class="empty"><h3>가계부를 불러오지 못했습니다</h3><p>' + LC.esc(e.message) + "</p></div>";
      })
      .then(function () { s.loading = false; });
  }

  function renderLedger() {
    var s = state.ledger;
    $("lCount").innerHTML = "<b>" + LC.num(s.total) + "</b>행 · 합계 <b>" + LC.num(s.sum) + "</b>원";
    $("lList").innerHTML = s.rows.length ? s.rows.map(function (r, i) {
      return '<button class="orow" data-ledger="' + i + '" style="grid-template-columns:minmax(0,1fr) auto">' +
        '<div class="orow-top"><span class="orow-date">' + r.date + '</span><span class="mk" style="--dc:' + r.color + '"><i></i>' +
        LC.esc(marketName(r.market)) + "</span>" + (r.order ? '<span class="badge badge-green">주문 대조</span>' : '<span class="badge">미대조</span>') +
        '</div><div class="orow-right" style="grid-row:span 2"><div class="orow-total tnum">' + LC.num(r.amount) + "원</div>" +
        '<div class="orow-meta">' + (r.category || "") + "</div></div>" +
        '<div class="orow-items">' + LC.esc(r.item || "") + "</div></button>";
    }).join("") : '<div class="empty"><h3>조건에 맞는 지출이 없습니다</h3><p>검색어나 마켓을 바꿔 보세요.</p></div>';
    $("lMore").innerHTML = s.rows.length < s.total
      ? '<button class="btn btn-ghost" data-more="1">더 보기 (' + LC.num(s.total - s.rows.length) + "행)</button>" : "";
    $("lList").querySelectorAll("[data-ledger]").forEach(function (b) {
      b.addEventListener("click", function () { openLedger(s.rows[+b.dataset.ledger]); });
    });
  }

  function openLedger(r) {
    LC.sheet({
      title: r.item || "(항목 없음)",
      subtitle: r.date + " · " + LC.num(r.amount) + "원",
      render: function (b) {
        var rows = [
          ["마켓", marketName(r.market)], ["분류", r.category || "–"], ["결제수단", r.payment || "–"],
          ["금액", LC.num(r.amount) + "원"], ["분류 신뢰도", r.confidence != null ? Math.round(r.confidence * 100) + "%" : "–"]
        ].map(function (x) {
          return '<div class="spec-row"><div class="k">' + x[0] + '</div><div class="v">' + LC.esc(x[1]) + "</div></div>";
        }).join("");
        var match = r.order
          ? '<div class="matched-box"><b>실주문과 대조됨</b><br>' + LC.date(r.order.date) + " · " + LC.num(r.order.total) + "원" +
            (r.order.status ? " · " + LC.esc(r.order.status) : "") + "<br><span class=\"muted\">방식 " +
            (r.order.method === "single" ? "단일주문 금액 일치" : r.order.method === "date_total" ? "일별 결제 합계 일치" : r.order.method) +
            (r.order.dateDelta != null ? " · 날짜차 " + r.order.dateDelta + "일" : "") +
            (r.order.amountDelta != null ? " · 금액차 " + LC.num(r.order.amountDelta) + "원" : "") + "</span></div>"
          : '<div class="unmatched-box">같은 기간·금액의 실주문을 찾지 못했습니다.</div>';
        b.innerHTML = '<div class="spec-table">' + rows + "</div>" +
          '<div class="section"><div class="section-head"><h3>주문 대조</h3></div>' + match + "</div>" +
          (r.memo ? '<div class="section"><div class="section-head"><h3>메모</h3></div><div class="note">' + LC.esc(r.memo) + "</div></div>" : "");
      },
      footer: '<button class="btn btn-ghost" data-act="close">닫기</button>'
    });
  }

  /* ------------------------------------------------------------- rebuy */
  var rebuyPending = null;
  function ensureRebuy() {
    if (state.rebuy) return Promise.resolve(state.rebuy);
    if (rebuyPending) return rebuyPending;
    rebuyPending = api("rebuy", {}).then(function (d) {
      state.rebuy = d;
      renderActPanel();
      renderUnitPanel();
      if (state.tab === "rebuy") renderRebuy(d);
      return d;
    }).catch(function (e) {
      rebuyPending = null;
      throw e;
    });
    return rebuyPending;
  }

  function initRebuy() {
    ensureRebuy().then(function (d) { renderRebuy(d); }).catch(function () {
      $("rebuyAll").innerHTML = '<div class="empty"><h3>재구매 데이터를 불러오지 못했습니다</h3></div>';
    });
  }

  function rcard(r) {
    var thumb = r.media
      ? '<img src="' + LC.esc(MEDIA + r.media) + '" alt="" loading="lazy" />'
      : LC.icon("box", "icon-sm");
    var dd = r.daysLeft;
    var badge = r.state === "due" ? '<span class="badge badge-red">도래</span>'
      : r.state === "soon" ? '<span class="badge badge-amber">D-' + dd + "</span>"
      : r.state === "stale" ? '<span class="badge">' + Math.abs(dd) + "일 경과</span>"
      : dd === null ? '<span class="badge">주기 미상</span>' : '<span class="badge badge-blue">D-' + dd + "</span>";
    var a = actOf(r);
    var u = unitOf(r);
    var sh = shrinkOf(r);
    return '<button class="rcard" data-rebuy="' + LC.esc(r.id) + '"><div class="item-thumb">' + thumb + "</div><div style=\"min-width:0\">" +
      '<div style="display:flex;gap:6px;align-items:flex-start;flex-wrap:wrap"><div class="item-name" style="flex:1">' + LC.text(r.label) + "</div>" +
      (a ? actBadge(a) : "") + badge + "</div>" +
      '<div class="statline"><span>주기 <b>' + (r.cycle ? Math.round(r.cycle) + "일" : "–") + "</b></span>" +
      "<span>평균 <b>" + LC.num(r.avg) + "</b></span><span>최저 <b>" + LC.num(r.min) + "</b></span>" +
      (r.saving ? '<span style="color:var(--c-green-text)">절감 <b>' + r.savingPct + "%</b></span>" : "") + "</div>" +
      '<div class="statline">다음 예상 <b>' + LC.date(r.next) + "</b>" + (r.now ? " · 다나와 최저 " + LC.num(r.now) + "원" : "") + "</div>" +
      ((u || sh) ? '<div class="statline">' + (u ? "<span>" + LC.esc(u.label) + " <b>" + LC.num(u.value) + "원</b></span>" : "") +
        (sh ? '<span style="color:var(--c-amber-text)">용량 −' + sh.pct + "%</span>" : "") + "</div>" : "") +
      "</div></button>";
  }

  function renderRebuy(d) {
    var rows = splitRows(d.rows || []);
    var hidden = (d.rows || []).length - rows.length;
    $("rebuyHint").textContent = LC.num(rows.length) + "개 상품군" + (hidden ? " (정산·디지털 " + hidden + "개 분리)" : "");
    if ($("rebuySplitHint")) $("rebuySplitHint").textContent = hidden ? "정산·결제·디지털 " + hidden + "개를 목록에서 뺐습니다" : "";
    var due = rows.filter(function (r) { return r.daysLeft !== null && r.daysLeft <= 0 && r.daysLeft >= -30; });
    var soon = rows.filter(function (r) { return r.daysLeft !== null && r.daysLeft > 0 && r.daysLeft <= 14; });
    var potential = rows.reduce(function (s2, r) { return s2 + (r.saving || 0); }, 0);
    $("rebuySummary").innerHTML = '<div class="statline" style="gap:16px;font-size:12.5px">' +
      "<span>도래 <b>" + due.length + "</b></span><span>14일 내 <b>" + soon.length + "</b></span>" +
      "<span>장기 미구매 <b>" + rows.filter(function (r) { return r.state === "stale"; }).length + "</b></span>" +
      "<span>절감 여지 합계 <b>" + LC.num(potential) + "원</b></span></div>";
    var byDue = rows.filter(function (r) { return r.daysLeft !== null && r.daysLeft >= -30 && r.daysLeft <= 21; })
      .sort(function (a, b) { return a.daysLeft - b.daysLeft; });
    var bySaving = rows.filter(function (r) { return r.saving > 0; }).sort(function (a, b) { return b.saving - a.saving; });
    $("rebuyDue").innerHTML = byDue.length ? byDue.map(rcard).join("")
      : '<div class="notice">21일 내 도래하는 재구매가 없습니다.</div>';
    $("rebuySaving").innerHTML = bySaving.slice(0, 12).map(rcard).join("") || '<div class="notice">절감 여지가 계산된 상품이 없습니다.</div>';
    $("rebuyAll").innerHTML = rows.slice().sort(function (a, b) { return String(a.label).localeCompare(String(b.label), "ko"); }).map(rcard).join("") ||
      '<div class="notice">표시할 상품군이 없습니다.</div>';
    document.querySelectorAll("[data-rebuy]").forEach(function (b) {
      b.addEventListener("click", function () {
        var r = d.rows.find(function (x) { return String(x.id) === b.dataset.rebuy; });
        if (r) openRebuy(r);
      });
    });
  }

  function openRebuy(r) {
    LC.sheet({
      title: r.label,
      subtitle: r.category || "반복구매 상품군",
      render: function (b) {
        var cells = [
          ["평균 구매가", LC.num(r.avg) + "원"], ["최저 구매가", LC.num(r.min) + "원"],
          ["목표가", r.target ? LC.num(r.target) + "원" : "–"], ["다나와 최저", r.now ? LC.num(r.now) + "원" : "–"]
        ];
        var a = actOf(r), u = unitOf(r), sh = shrinkOf(r);
        var actHtml = a
          ? '<div class="act-block" style="margin-top:0"><div class="act-line">' + actBadge(a, true) +
            '<span class="badge">' + LC.esc(a.verdict.basis || "구매 주기·가격 기준") + "</span>" +
            (r.target ? '<span class="badge badge-green">목표가 ' + LC.won(r.target) + "</span>" : "") + "</div>" +
            '<div class="act-cells">' +
              (u ? '<div class="cell"><div class="cell-k">' + LC.esc(u.label) + '</div><div class="cell-v tnum">' + LC.won(u.value) + "</div></div>" : "") +
              '<div class="cell"><div class="cell-k">다음 구매</div><div class="cell-v tnum">' + LC.ddayLabel(r.daysLeft) + "</div></div>" +
              (r.now ? '<div class="cell"><div class="cell-k">다나와 최저</div><div class="cell-v tnum">' + LC.won(r.now) + "</div></div>" : "") +
              '<div class="cell"><div class="cell-k">평균 대비</div><div class="cell-v tnum">' +
                (r.now && r.avg ? ((r.now - r.avg > 0 ? "+" : "") + Math.round((r.now - r.avg) / r.avg * 100) + "%") : "–") + "</div></div>" +
            "</div>" +
            (sh ? '<div class="note" style="margin-top:9px;background:var(--c-amber-weak);border-color:#ffe0bf;color:var(--c-amber-text)"><b>슈링크플레이션 −' +
              sh.pct + "%</b> — 다나와에 지금 등록된 규격이 내가 산 것보다 작습니다.</div>" : "") +
            "</div>"
          : "";
        b.innerHTML = actHtml +
          '<div class="price-hero" style="margin-top:' + (actHtml ? "12px" : "0") + '"><div class="price-hero-main"><b class="tnum">' + LC.num(r.avg) +
          "</b><span>원 · 평균 구매가</span></div><div class=\"price-cells\">" +
          cells.map(function (c) {
            return '<div class="cell"><div class="cell-k">' + c[0] + '</div><div class="cell-v tnum">' + c[1] + "</div></div>";
          }).join("") + "</div></div>" +
          '<div class="section"><div class="section-head"><h3>구매 주기</h3></div><div class="spec-table">' +
          '<div class="spec-row"><div class="k">구매 횟수</div><div class="v">' + (r.buys || 0) + "회</div></div>" +
          '<div class="spec-row"><div class="k">평균 주기</div><div class="v">' + (r.cycle ? Math.round(r.cycle) + "일" : "–") + "</div></div>" +
          '<div class="spec-row"><div class="k">마지막 구매</div><div class="v">' + LC.date(r.last) + "</div></div>" +
          '<div class="spec-row"><div class="k">다음 예상</div><div class="v">' + LC.date(r.next) +
          (r.daysLeft !== null ? " (" + (r.daysLeft <= 0 ? "도래" : "D-" + r.daysLeft) + ")" : "") + "</div></div></div></div>" +
          (r.saving ? '<div class="note">절감 여지 <b>' + LC.num(r.saving) + "원(" + r.savingPct +
            "%)</b> — 최저 구매가 기준으로 다시 살 수 있으면 이만큼 아낄 수 있습니다.</div>" : "") +
          (r.spec ? '<div class="section"><div class="section-head"><h3>다나와 스펙</h3>' +
            (r.url ? '<span class="hint"><a href="' + LC.esc(r.url) + '" target="_blank" rel="noopener">원문</a></span>' : "") +
            '</div><div class="note">' + LC.esc(r.spec) + "</div></div>" : "");
      },
      footer: '<button class="btn btn-ghost" data-act="close">닫기</button>'
    });
  }
})();
