/* 렛츠카트 공개 카탈로그 — index.html */
(function () {
  "use strict";
  var LC = window.LC;
  var REPO = "pyw31337/cart";
  var ACT = window.LetsCartAction || null;
  var TODAY = LC.today();
  var actCache = {};

  var MARKET_LOGO = {
    coupang: "coupang", kurly: "kurly", gmarket: "gmarket", naver: "naver", npay: "npay",
    "11st": "11st", lotteon: "lotteon", ohou: "ohou", ssg: "ssg", auction: "auction",
    megamart: "megamart", baemin: "baemin", danawa: "danawa", enuri: "enuri"
  };
  function logoHtml(code, name, size) {
    var f = MARKET_LOGO[code] || MARKET_LOGO[String(name || "").toLowerCase()];
    if (!f) return "";
    var px = size || 16;
    return '<img class="mkt-logo" src="assets/logos/' + f + '.webp" alt="" width="' + px + '" height="' + px +
      '" loading="lazy" style="width:' + px + "px;height:" + px + 'px" />';
  }
  function actionOf(p) {
    if (!ACT) return null;
    if (actCache[p.id]) return actCache[p.id];
    var r = null;
    try { r = ACT.judgeCatalog(p, TODAY); } catch (e) { r = null; }
    actCache[p.id] = r;
    return r;
  }
  function actBadge(a, big) {
    if (!a || !a.meta) return "";
    return '<span class="act ' + a.meta.cls + (big ? " act-lg" : "") + '">' + LC.esc(a.meta.label) + "</span>";
  }

  var state = {
    data: null,
    mediaBase: "",
    q: "",
    cat: "all",
    rebuy: false,
    image: false,
    spec: false,
    minRating: 0,
    sort: "reviews",
    shown: 24
  };
  var PAGE = 24;

  var el = {
    grid: document.getElementById("grid"),
    more: document.getElementById("more"),
    count: document.getElementById("count"),
    q: document.getElementById("q"),
    searchBox: document.getElementById("searchBox"),
    catChips: document.getElementById("catChips"),
    filterbar: document.getElementById("filterbar")
  };

  /* ---------------------------------------------------------------- load */
  el.grid.innerHTML = LC.skeletonCards(8);
  fetch("data/catalog.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (d) {
      state.data = d.products;
      state.mediaBase = d.mediaBase;
      state.marketList = d.markets || [];
      buildHero(d.stats);
      buildCats(d.categories);
      wireUI();
      render();
    })
    .catch(function (e) {
      el.grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><h3>카탈로그를 불러오지 못했습니다</h3><p>' +
        LC.esc(e.message) + " · 잠시 후 다시 시도해 주세요.</p><p style=\"font-size:10px\">" + LC.esc(String(e.stack||"").replace(/\n/g," | ").slice(0,400)) + "</p></div>";
      el.count.textContent = "불러오기 실패";
    });

  function buildHero(s) {
    var stats = document.getElementById("heroStats");
    if (!stats) { renderAside(); return; }
    var cells = [
      [LC.num(s.products) + "종", "카탈로그 상품"],
      [LC.num(s.withSpec), "스펙·평점 보유"],
      [LC.num(s.rebuy), "반복구매 상품군"],
      [LC.compact(s.reviews), "누적 리뷰"]
    ];
    stats.innerHTML = cells.map(function (c) {
      return '<div class="hstat"><div class="hstat-label">' + c[1] + '</div><div class="hstat-value tnum">' +
        c[0].replace(/^([\d.,]+)(.*)$/, "$1<span>$2</span>") + "</div></div>";
    }).join("");
    renderAside();
  }

  function renderAside() {
    var aside = document.getElementById("heroAside");
    if (!aside) return;
    var due = 0, hit = 0, saving = 0, tracked = 0;
    state.data.forEach(function (p) {
      if (p.tracked) tracked++;
      if (p.rebuy && p.rebuy.next) {
        var d = LC.dday(p.rebuy.next);
        if (d !== null && d <= 14 && d >= -30) due++;
      }
      if (p.price && p.rebuy && p.rebuy.target && p.price <= p.rebuy.target) hit++;
      if (p.rebuy && p.rebuy.avg && p.rebuy.min && p.rebuy.avg > p.rebuy.min) saving += p.rebuy.avg - p.rebuy.min;
    });
    aside.innerHTML = '<div class="aside-row">' +
        '<div class="aside-ico" style="background:var(--c-amber-weak);color:var(--c-amber-text)">' + LC.icon("clock") + "</div>" +
        '<div><div class="aside-k">14일 내 구매 주기 도래</div><div class="aside-v tnum">' + due + "<small>개 상품</small></div></div></div>" +
      '<div class="aside-row">' +
        '<div class="aside-ico" style="background:var(--c-green-weak);color:var(--c-green-text)">' + LC.icon("trend") + "</div>" +
        '<div><div class="aside-k">지금 목표가 이하</div><div class="aside-v tnum">' + hit + "<small>개 상품</small></div></div></div>" +
      '<div class="aside-row">' +
        '<div class="aside-ico" style="background:var(--c-blue-weak);color:var(--c-blue)">' + LC.icon("tag") + "</div>" +
        '<div><div class="aside-k">최저가로 다시 살면 아끼는 금액</div><div class="aside-v tnum">' +
        LC.num(saving) + "<small>원 · " + tracked + '개 추적 상품</small></div></div></div>';
  }

  function buildCats(cats) {
    var top = cats.slice(0, 14);
    var html = '<button class="chip" data-value="all" aria-pressed="true">전체 <span class="count tnum">' +
      LC.num(state.data.length) + "</span></button>";
    html += top.map(function (c) {
      return '<button class="chip" data-value="' + LC.esc(c.name) + '" aria-pressed="false">' +
        LC.esc(shortCat(c.name)) + ' <span class="count tnum">' + c.count + "</span></button>";
    }).join("");
    if (cats.length > top.length) {
      html += '<button class="chip" data-value="__more">+ ' + (cats.length - top.length) + "개 분류</button>";
    }
    el.catChips.innerHTML = html;
    LC.chipGroup(el.catChips, function (v) {
      if (el.catChips.dataset.expand === "1" && v[v.length - 1] === "__more") return;
      state.cat = v[0] || "all";
      state.shown = PAGE;
      render();
    });
    el.catChips.addEventListener("click", function (e) {
      var b = e.target.closest('.chip[data-value="__more"]');
      if (b) {
        el.catChips.dataset.expand = "1";
        el.catChips.innerHTML = '<button class="chip" data-value="all" aria-pressed="' +
          (state.cat === "all" ? "true" : "false") + '">전체 <span class="count tnum">' +
          LC.num(state.data.length) + "</span></button>" +
          cats.map(function (c) {
            return '<button class="chip" data-value="' + LC.esc(c.name) + '" aria-pressed="' +
              (state.cat === c.name ? "true" : "false") + '">' + LC.esc(c.name) +
              ' <span class="count tnum">' + c.count + "</span></button>";
          }).join("");
      }
    });
  }

  function shortCat(s) {
    return s.length > 12 ? s.slice(0, 12) + "…" : s;
  }

  /* ---------------------------------------------------------------- ui */
  function wireUI() {
    LC.paintIcons(document);

    var onSearch = LC.debounce(function () {
      state.q = el.q.value.trim().toLowerCase();
      state.shown = PAGE;
      el.searchBox.classList.toggle("has-value", !!el.q.value);
      render();
    }, 160);
    el.q.addEventListener("input", onSearch);
    document.getElementById("qClear").addEventListener("click", function () {
      el.q.value = "";
      state.q = "";
      el.searchBox.classList.remove("has-value");
      state.shown = PAGE;
      render();
      el.q.focus();
    });

    var sort = LC.dropdown(document.getElementById("sortDD"), function (v) {
      state.sort = v; state.shown = PAGE; render();
    });
    state.sort = sort.value || "reviews";

    ["chipRebuy:rebuy", "chipImage:image"].forEach(function (pair) {
      var p = pair.split(":"), b = document.getElementById(p[0]), key = p[1];
      b.addEventListener("click", function () {
        state[key] = !state[key];
        b.setAttribute("aria-pressed", state[key] ? "true" : "false");
        state.shown = PAGE;
        render();
      });
    });

    document.getElementById("btnFilter").addEventListener("click", openFilter);
    document.getElementById("btnRequest").addEventListener("click", function () { openRequest(null); });
    document.getElementById("btnMy").addEventListener("click", function (e) {
      if (location.hostname.endsWith("github.io")) {
        e.preventDefault();
        LC.sheet({
          title: "내 지출·재구매 허브",
          subtitle: "Cloudflare Access로 보호되는 개인 영역",
          render: function (b) {
            b.innerHTML = '<div class="note"><b>내 지출 허브는 letscart.pages.dev 에서 열립니다.</b><br>' +
              "가계부·주문·재구매 알림은 개인 정보라 Cloudflare Access(이메일 인증) 뒤에 두었습니다. " +
              "GitHub Pages에는 개인 데이터가 포함되지 않습니다.</div>" +
              '<a class="btn btn-primary" style="margin-top:14px;width:100%" href="https://letscart.pages.dev/my">' +
              "letscart.pages.dev/my 열기</a>";
          }
        });
      }
    });

    el.grid.addEventListener("click", function (e) {
      var c = e.target.closest(".card");
      if (!c) return;
      var p = state.data.find(function (x) { return x.id === c.dataset.id; });
      if (p) openDetail(p);
    });
    el.more.addEventListener("click", function (e) {
      if (e.target.closest("[data-act=more]")) { state.shown += PAGE; render(); }
    });
    window.addEventListener("scroll", function () {
      el.filterbar.classList.toggle("stuck", window.scrollY > 120);
    }, { passive: true });
  }

  function openFilter() {
    var ratingChips = [
      ["0", "전체"], ["4.5", "4.5 이상"], ["4.0", "4.0 이상"], ["3.5", "3.5 이상"]
    ];
    LC.sheet({
      title: "필터",
      render: function (b) {
        b.innerHTML =
          '<div class="section" style="margin-top:0"><div class="section-head"><h3>평점</h3></div>' +
          '<div class="chiprow" id="fRating" data-multi="false" style="flex-wrap:wrap;overflow:visible">' +
          ratingChips.map(function (c) {
            return '<button class="chip" data-value="' + c[0] + '" aria-pressed="' +
              (String(state.minRating) === c[0] ? "true" : "false") + '">' + c[1] + "</button>";
          }).join("") + "</div></div>" +
          '<div class="section"><div class="section-head"><h3>데이터</h3></div>' +
          '<div class="chiprow" id="fFlags" data-multi="true" style="flex-wrap:wrap;overflow:visible">' +
          '<button class="chip" data-value="spec" aria-pressed="' + (state.spec ? "true" : "false") + '">다나와 스펙 보유</button>' +
          '<button class="chip" data-value="image" aria-pressed="' + (state.image ? "true" : "false") + '">사진 보유</button>' +
          '<button class="chip" data-value="rebuy" aria-pressed="' + (state.rebuy ? "true" : "false") + '">반복구매 상품</button>' +
          "</div></div>" +
          '<div class="note" style="margin-top:6px">평점·스펙은 다나와 매칭이 확인된 상품에만 표시됩니다. ' +
          "매칭 신뢰도가 낮은 상품은 이름·구매 이력만 보여 줍니다.</div>" +
          '<div class="section"><div class="section-head"><h3>지원 마켓</h3><span class="hint">로고: 렛츠바이 자산 WebP</span></div>' +
          '<div class="mkt-support">' + (state.marketList || []).map(function (m) {
            return '<span>' + logoHtml(m.code, m.name, 22) + LC.esc(m.name) + "</span>";
          }).join("") + "</div></div>";
      },
      footer: '<button class="btn btn-ghost" data-act="reset">초기화</button>' +
              '<button class="btn btn-primary" data-act="apply">적용</button>',
      onAction: function (act, btn, sheet) {
        if (act === "reset") {
          state.minRating = 0; state.spec = false; state.image = false; state.rebuy = false;
          document.getElementById("chipRebuy").setAttribute("aria-pressed", "false");
          document.getElementById("chipImage").setAttribute("aria-pressed", "false");
          sheet.close(); state.shown = PAGE; render(); LC.toast("필터를 초기화했습니다");
          return;
        }
        var r = LC.chipValues(sheet.body.querySelector("#fRating"))[0] || "0";
        var f = LC.chipValues(sheet.body.querySelector("#fFlags"));
        state.minRating = parseFloat(r);
        state.spec = f.indexOf("spec") >= 0;
        state.image = f.indexOf("image") >= 0;
        state.rebuy = f.indexOf("rebuy") >= 0;
        document.getElementById("chipRebuy").setAttribute("aria-pressed", state.rebuy ? "true" : "false");
        document.getElementById("chipImage").setAttribute("aria-pressed", state.image ? "true" : "false");
        sheet.close(); state.shown = PAGE; render();
        LC.toast("필터를 적용했습니다");
      }
    });
  }

  /* ---------------------------------------------------------------- render */
  function priceOf(p) {
    if (p.price) return p.price;
    if (p.tracker && p.tracker.minPrice) return p.tracker.minPrice;
    if (p.markets && p.markets[0] && p.markets[0].price) return p.markets[0].price;
    if (p.rebuy && p.rebuy.avg) return p.rebuy.avg;
    return null;
  }

  function filtered() {
    var q = state.q;
    var out = state.data.filter(function (p) {
      if (state.cat !== "all" && p.group !== state.cat) return false;
      if (state.rebuy && !p.rebuy) return false;
      if (state.image && !p.media) return false;
      if (state.spec && !(p.rating || p.spec)) return false;
      if (state.minRating && (!p.rating || p.rating < state.minRating)) return false;
      if (q) {
        var hay = (p.name + " " + (p.brand || "") + " " + (p.category || "") + " " + (p.group || "") + " " +
          (p.danawaName || "")).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var cmpH = function (k) { return function (a, b) { return (b[k] || 0) - (a[k] || 0); }; };
    var cmpL = function (k) { return function (a, b) { return (a[k] || 1e12) - (b[k] || 1e12); }; };
    var sorts = {
      reviews: function (a, b) { return (b.reviews || 0) - (a.reviews || 0) || (b.rating || 0) - (a.rating || 0); },
      rating: cmpH("rating"),
      "price-asc": cmpL("_price"),
      "price-desc": cmpH("_price"),
      cycle: function (a, b) {
        var da = a.rebuy && a.rebuy.next ? LC.dday(a.rebuy.next) : null;
        var db = b.rebuy && b.rebuy.next ? LC.dday(b.rebuy.next) : null;
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      },
      name: function (a, b) { return a.name.localeCompare(b.name, "ko"); }
    };
    out.forEach(function (p) { p._price = priceOf(p) || 0; });
    return out.sort(sorts[state.sort] || sorts.reviews);
  }

  function render() {
    var list = filtered();
    el.count.innerHTML = "<b>" + LC.num(list.length) + "</b>개 상품" +
      (state.cat !== "all" ? " · " + LC.esc(state.cat) : "") +
      (state.q ? ' · "' + LC.esc(state.q) + '"' : "");

    if (!list.length) {
      el.grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><h3>조건에 맞는 상품이 없습니다</h3>' +
        "<p>검색어나 필터를 바꿔 보세요. 없는 상품이면 관심 상품으로 요청할 수 있습니다.</p>" +
        '<button type="button" class="btn btn-ghost" style="margin-top:14px" onclick="document.getElementById(\'btnRequest\').click()">관심 상품 요청</button></div>';
      el.more.innerHTML = "";
      return;
    }
    var slice = list.slice(0, state.shown);
    el.grid.innerHTML = slice.map(card).join("");
    el.more.innerHTML = list.length > state.shown
      ? '<button type="button" class="btn btn-ghost" data-act="more">더 보기 (' +
        LC.num(list.length - state.shown) + '개)</button>'
      : "";
  }

  function card(p) {
    var price = priceOf(p);
    var img = p.media
      ? '<img src="' + LC.esc(LC.mediaUrl(state.mediaBase, p.media)) + '" alt="' + LC.esc(p.name) +
        '" loading="lazy" decoding="async" width="240" height="240" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'noimg\')" />'
      : "";
    var badges = [];
    var a = actionOf(p);
    if (a) badges.push(actBadge(a));
    if (p.tracked) badges.push('<span class="badge badge-blue">추적 중</span>');
    if (p.rebuy && p.rebuy.next && LC.dday(p.rebuy.next) >= -30) {
      var dd = LC.dday(p.rebuy.next);
      var cls = dd !== null && dd <= 14 ? "badge-amber" : "";
      badges.push('<span class="badge ' + cls + '">' + LC.ddayLabel(dd) + "</span>");
    } else if (p.rebuy && p.rebuy.cycle) {
      badges.push('<span class="badge">주기 ' + Math.round(p.rebuy.cycle) + "일</span>");
    }
    if (p.rebuy && p.rebuy.avg && p.rebuy.min && p.rebuy.avg > p.rebuy.min * 1.1) {
      badges.push('<span class="badge badge-green">절감 ' +
        Math.round((1 - p.rebuy.min / p.rebuy.avg) * 100) + "%</span>");
    }
    if (!badges.length && p.offers) badges.push('<span class="badge">' + LC.compact(p.offers) + "곳 최저가</span>");

    return '<article class="card" data-id="' + LC.esc(p.id) + '" tabindex="0" role="button" aria-label="' +
      LC.esc(p.name) + ' 상세 보기">' +
      '<div class="card-hit">' +
        '<div class="thumb">' + (img || LC.placeholder("box")) + "</div>" +
        '<div class="card-body">' +
          '<div class="card-cat"><span>' + LC.esc(p.group || "기타") + "</span></div>" +
          '<h3 class="card-name">' + LC.text(p.name) + "</h3>" +
          '<div class="card-rating">' + (p.rating ? LC.rating(p.rating, p.reviews) : '<span class="muted">스펙 미매칭</span>') + "</div>" +
          '<div class="card-price"><b class="tnum">' + LC.num(price) + "</b><small>원</small>" +
            (p.price ? '<small>다나와 최저</small>' : "") + "</div>" +
          (a && a.unit ? '<div class="card-unit"><span>' + LC.esc(a.unit.label) + " " + LC.won(a.unit.value) + "</span></div>" : "") +
          '<div class="card-badges">' + badges.join("") + "</div>" +
        "</div>" +
      "</div></article>";
  }

  /* ---------------------------------------------------------------- detail */
  /* 4단 행동 판정 + 단위가격 + 할인 주기 + 슈링크플레이션 */
  function actBlock(p) {
    var a = actionOf(p);
    if (!a) return "";
    var cells = [];
    if (a.unit) cells.push([a.unit.label, LC.won(a.unit.value)]);
    if (a.count >= 2 && a.avgGap > 0) cells.push(["사는 주기", a.avgGap + "일"]);
    if (a.daysLeft !== 9999 && a.daysLeft !== undefined) cells.push(["다음 구매", LC.ddayLabel(a.daysLeft)]);
    if (a.nextDip) cells.push(["할인 주기", a.nextDip.gap + "일마다 · " + LC.shortDate(a.nextDip.date)]);
    if (a.avg) cells.push(["최근 평균", LC.won(a.avg)]);
    if (!cells.length) cells.push(["내 구매", a.count ? a.count + "회" : "기록 없음"]);
    return '<div class="act-block">' +
      '<div class="act-line">' + actBadge(a, true) +
        (a.verdict.basis ? '<span class="badge">' + LC.esc(a.verdict.basis) + "</span>" : "") +
        (a.target ? '<span class="badge badge-green">목표가 ' + LC.won(a.target) + "</span>" : "") +
      "</div>" +
      (a.say ? '<p class="act-say">' + LC.esc(a.say) + "</p>" : "") +
      '<div class="act-cells">' + cells.slice(0, 4).map(function (c) {
        return '<div class="cell"><div class="cell-k">' + LC.esc(c[0]) + '</div><div class="cell-v tnum">' + c[1] + "</div></div>";
      }).join("") + "</div>" +
      (a.shrink ? '<div class="note" style="margin-top:9px;background:var(--c-amber-weak);border-color:#ffe0bf;color:var(--c-amber-text)"><b>슈링크플레이션 ' +
        "−" + a.shrink.pct + "%</b> — 다나와에 지금 등록된 규격이 내가 산 것보다 작습니다.</div>" : "") +
      "</div>";
  }

  function openDetail(p) {
    var price = priceOf(p);
    var s = LC.sheet({
      title: p.name,
      variant: "sheet-detail",
      subtitle: p.brand || p.group,
      render: function (b) {
        var img = p.media
          ? '<img src="' + LC.esc(LC.mediaUrl(state.mediaBase, p.media)) + '" alt="' + LC.esc(p.name) + '" loading="eager" />'
          : LC.placeholder("box");
        var meta = [];
        if (p.group) meta.push('<span class="badge">' + LC.esc(p.group) + "</span>");
        if (p.tracked) meta.push('<span class="badge badge-blue">추적 중</span>');
        if (p.rating) meta.push('<span class="badge">★ ' + Number(p.rating).toFixed(1) + "</span>");
        if (p.reviews) meta.push('<span class="badge">후기 ' + LC.num(p.reviews) + "</span>");
        if (p.offers) meta.push('<span class="badge">' + LC.num(p.offers) + "곳 판매</span>");

        var cells = [];
        if (p.price) cells.push(["다나와 최저", LC.num(p.price) + "원"]);
        if (p.tracker) {
          cells.push(["내 평균 구매", LC.num(p.tracker.avgPrice) + "원"]);
          cells.push(["목표가", LC.num(p.tracker.targetPrice) + "원"]);
          cells.push(["구매주기", (p.tracker.cycleDays ? Math.round(p.tracker.cycleDays) + "일" : "–")]);
        } else if (p.rebuy) {
          cells.push(["내 평균 구매", LC.num(p.rebuy.avg) + "원"]);
          cells.push(["목표가", LC.num(p.rebuy.target) + "원"]);
          cells.push(["구매주기", p.rebuy.cycle ? Math.round(p.rebuy.cycle) + "일" : "–"]);
        }
        var dd = p.rebuy && p.rebuy.next ? LC.dday(p.rebuy.next) : null;

        b.innerHTML =
          '<div class="detail-hero"><div class="thumb">' + img + "</div><div>" +
            '<h3 class="detail-name">' + LC.text(p.danawaName || p.name) + "</h3>" +
            '<div class="detail-meta">' + meta.join("") + "</div>" +
            (p.category ? '<div class="muted" style="font-size:11.5px;margin-top:8px;line-height:1.5">' + LC.esc(p.category) + "</div>" : "") +
          "</div></div>" +
          '<div class="price-hero">' +
            '<div class="price-hero-main"><b class="tnum">' + LC.num(price) + "</b><span>원" +
              (p.price ? " · 다나와 최저가" : "") + "</span></div>" +
            '<div class="price-cells">' + cells.map(function (c) {
              return '<div class="cell"><div class="cell-k">' + c[0] + '</div><div class="cell-v tnum">' + c[1] + "</div></div>";
            }).join("") + "</div>" +
            (dd !== null ? '<div style="margin-top:10px;display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:' +
              (dd <= 14 && dd >= -30 ? "var(--c-amber-text)" : "var(--c-text-2)") + '">' + LC.icon("clock", "icon-sm") +
              "다음 구매 예상 " + LC.date(p.rebuy.next) + " · " +
              (dd >= 0 ? LC.ddayLabel(dd) : Math.abs(dd) + "일 경과") + "</div>" : "") +
          "</div>" +
          actBlock(p) +
          (p.rebuy && p.rebuy.avg && p.rebuy.min && p.rebuy.avg > p.rebuy.min
            ? '<div class="note" style="margin-top:12px">평균 구매가 <b>' + LC.num(p.rebuy.avg) + "원</b> vs 최저 구매가 <b>" +
              LC.num(p.rebuy.min) + "원</b> — 회당 <b>" + LC.num(p.rebuy.avg - p.rebuy.min) + "원(" +
              Math.round((1 - p.rebuy.min / p.rebuy.avg) * 100) + "%)</b> 절감 여지가 있습니다.</div>" : "") +
          chartSection(p) +
          specSection(p) +
          marketSection(p) +
          (p.tracker && p.tracker.note ? '<div class="section"><div class="note">' + LC.esc(p.tracker.note) + "</div></div>" : "") +
          (p.tracker && p.tracker.crossNote ? '<div class="section"><div class="note">' + LC.esc(p.tracker.crossNote) + "</div></div>" : "");
      },
      footer: '<button class="btn btn-ghost" data-act="req">관심 상품 신청</button>' +
        (p.danawaUrl ? '<a class="btn btn-primary" href="' + LC.esc(p.danawaUrl) + '" target="_blank" rel="noopener">다나와에서 보기</a>' :
          (p.markets && p.markets[0] && p.markets[0].url
            ? '<a class="btn btn-primary" href="' + LC.esc(p.markets[0].url) + '" target="_blank" rel="noopener">마켓에서 보기</a>' : "")),
      onAction: function (act) { if (act === "req") { s.close(); openRequest(p); } }
    });
  }

  function chartSection(p) {
    var hist = (p.history || []).slice();
    if (p.tracker && p.tracker.history) hist = hist.concat(p.tracker.history);
    var byDate = {};
    hist.forEach(function (h) { if (h.price) byDate[h.date] = h.price; });
    var pts = Object.keys(byDate).sort().map(function (d) { return { d: d, v: byDate[d] }; });
    if (pts.length < 2) {
      return '<div class="section"><div class="section-head"><h3>가격 이력</h3></div>' +
        '<div class="note">확인된 가격이 1건뿐입니다. 다나와 최저가 <b>' + LC.num(p.price) + "원</b> (2026-11-20 수집)" +
        (p.rebuy && p.rebuy.min ? " · 과거 구매가 범위 <b>" + LC.num(p.rebuy.min) + "원~" + LC.num(p.rebuy.max) + "원</b>" : "") +
        "입니다.</div></div>";
    }
    var W = 320, H = 128, pad = 26;
    var vs = pts.map(function (x) { return x.v; });
    var mn = Math.min.apply(null, vs), mx = Math.max.apply(null, vs);
    var span = Math.max(1, mx - mn);
    var x = function (i) { return pad + (i / (pts.length - 1)) * (W - pad - 6); };
    var y = function (v) { return H - 18 - ((v - mn) / span) * (H - 40); };
    var line = pts.map(function (q, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(q.v).toFixed(1); }).join(" ");
    var area = line + " L" + x(pts.length - 1).toFixed(1) + " " + (H - 18) + " L" + pad + " " + (H - 18) + " Z";
    var dots = pts.map(function (q, i) {
      if (pts.length > 14 && i !== 0 && i !== pts.length - 1 && i % Math.ceil(pts.length / 8) !== 0) return "";
      return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(q.v).toFixed(1) + '" r="2.6" fill="#3182F6" />';
    }).join("");
    return '<div class="section"><div class="section-head"><h3>가격 이력</h3>' +
      '<span class="hint">' + pts.length + "개 시점</span></div>" +
      '<div class="chart"><div class="chart-legend"><span><i style="background:#3182F6"></i>구매·확인가</span>' +
      "<span>최저 " + LC.num(mn) + "원 · 최고 " + LC.num(mx) + "원</span></div>" +
      '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="가격 이력 선 그래프">' +
      '<defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3182F6" stop-opacity=".18"/>' +
      '<stop offset="1" stop-color="#3182F6" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#g1)"/><path d="' + line + '" fill="none" stroke="#3182F6" stroke-width="2" ' +
      'stroke-linejoin="round" stroke-linecap="round"/>' + dots +
      '<text x="' + pad + '" y="' + H + '" font-size="9" fill="#8B95A1">' + LC.shortDate(pts[0].d) + "</text>" +
      '<text x="' + (W - 6) + '" y="' + H + '" font-size="9" fill="#8B95A1" text-anchor="end">' +
      LC.shortDate(pts[pts.length - 1].d) + "</text></svg></div></div>";
  }

  function specSection(p) {
    var rows = (p.specTable || []).filter(function (r) { return r.v; });
    if (!rows.length) {
      return '<div class="section"><div class="section-head"><h3>다나와 스펙</h3></div>' +
        '<div class="note">다나와 스펙 매칭이 없습니다. 상품명·구매 이력만 제공합니다.</div></div>';
    }
    var html = "", lastSec = null;
    rows.slice(0, 40).forEach(function (r) {
      if (r.s && r.s !== lastSec) { html += '<div class="spec-sec">' + LC.text(r.s) + "</div>"; lastSec = r.s; }
      html += '<div class="spec-row">' + (r.k ? '<div class="k">' + LC.text(r.k) + '</div><div class="v">' +
        LC.text(r.v) + "</div>" : '<div class="v" style="grid-column:1/-1;font-weight:600">' + LC.text(r.v) + "</div>") + "</div>";
    });
    return '<div class="section"><div class="section-head"><h3>다나와 스펙</h3>' +
      '<span class="hint">' + (p.danawaUrl ? '<a href="' + LC.esc(p.danawaUrl) + '" target="_blank" rel="noopener">원문</a>' : "") +
      "</span></div><div class=\"spec-table\">" + html + "</div></div>";
  }

  function marketSection(p) {
    if (!p.markets || !p.markets.length) return "";
    var rows = p.markets.map(function (m) {
      var mk = (state.marketMap || {})[m.code] || {};
      return '<a class="mkt-row" href="' + LC.esc(m.url || "#") + '" target="_blank" rel="noopener">' +
        (logoHtml(m.code, m.label, 20) || '<span class="mkt-dot" style="--dc:' + (mk.color || "#8B95A1") + '"></span>') +
        '<span><span class="mkt-name">' + LC.esc(m.label || m.code) + "</span>" +
        '<span class="mkt-date"> · ' + LC.date(m.date) + (m.status && m.status !== "판매중" ? " · " + LC.esc(m.status) : "") + "</span></span>" +
        '<span class="mkt-price tnum">' + LC.num(m.price) + "원</span></a>";
    }).join("");
    return '<div class="section"><div class="section-head"><h3>마켓별 가격</h3><span class="hint">최근 확인가</span></div>' +
      '<div class="mkt-list">' + rows + "</div></div>";
  }

  /* ---------------------------------------------------------------- request */
  function openRequest(p) {
    var s = LC.sheet({
      title: "관심 상품 신청",
      subtitle: "GitHub 이슈로 등록되어 매일 가격 점검 목록에 추가됩니다",
      render: function (b) {
        b.innerHTML =
          '<div class="field"><label for="rqName">상품명</label>' +
          '<input class="input" id="rqName" value="' + LC.esc(p ? p.name : "") + '" placeholder="예: 곰곰 신선한 우유 900ml" /></div>' +
          '<div class="field"><label for="rqUrl">상품 URL</label>' +
          '<input class="input" id="rqUrl" value="' + LC.esc(p && p.markets && p.markets[0] ? (p.markets[0].url || "") : "") +
          '" placeholder="https://…" inputmode="url" /></div>' +
          '<div class="field"><label for="rqTarget">목표 알림가 (원)</label>' +
          '<input class="input" id="rqTarget" inputmode="numeric" placeholder="예: 15000" value="' +
          LC.esc(p && p.tracker && p.tracker.targetPrice ? p.tracker.targetPrice : (p && p.rebuy && p.rebuy.target ? p.rebuy.target : "")) + '" /></div>' +
          '<div class="field"><label for="rqMemo">메모 (선택)</label>' +
          '<textarea class="textarea" id="rqMemo" placeholder="재입고 대기, 대체 상품 비교 등"></textarea></div>' +
          '<div class="note">신청은 <b>@' + REPO + "</b> 저장소의 공개 이슈로 올라갑니다. 로그인되어 있지 않으면 GitHub 로그인 화면이 먼저 뜹니다.</div>";
      },
      footer: '<button class="btn btn-ghost" data-act="cancel">취소</button>' +
        '<button class="btn btn-primary" data-act="submit">이슈로 신청</button>',
      onAction: function (act, btn, sheet) {
        if (act === "cancel") { sheet.close(); return; }
        var name = sheet.body.querySelector("#rqName").value.trim();
        if (!name) { LC.toast("상품명을 입력해 주세요"); return; }
        var url = sheet.body.querySelector("#rqUrl").value.trim();
        var target = sheet.body.querySelector("#rqTarget").value.trim();
        var memo = sheet.body.querySelector("#rqMemo").value.trim();
        var body = ["- 상품명: " + name, "- URL: " + (url || "(없음)"),
          "- 목표가: " + (target ? Number(target.replace(/[^\d]/g, "")).toLocaleString("ko-KR") + "원" : "(미지정)"),
          "- 메모: " + (memo || "(없음)"), "", "_렛츠카트 카탈로그에서 신청_"].join("\n");
        var gh = "https://github.com/" + REPO + "/issues/new?labels=track-request&title=" +
          encodeURIComponent("[관심상품] " + name) + "&body=" + encodeURIComponent(body);
        sheet.close();
        window.open(gh, "_blank", "noopener");
        LC.toast("GitHub 이슈 화면을 열었습니다");
      }
    });
    return s;
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && document.activeElement && document.activeElement.classList.contains("card")) {
      document.activeElement.click();
    }
  });
})();
