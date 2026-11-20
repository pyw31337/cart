/* 렛츠카트 — shared UI kit (Zero-System-UI)
   - 커스텀 시트/드로어, 드롭다운, 토스트, 칩, 검색
   - 네이티브 select / alert / confirm / prompt 사용 없음 */
(function () {
  "use strict";

  var LC = (window.LC = {});

  /* ------------------------------------------------------------------ format */
  LC.num = function (n) {
    if (n === null || n === undefined || isNaN(n)) return "–";
    return Math.round(n).toLocaleString("ko-KR");
  };
  LC.won = function (n) {
    if (n === null || n === undefined || isNaN(n)) return "–";
    return LC.num(n) + "원";
  };
  LC.compact = function (n) {
    if (!n) return "0";
    if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, "") + "억";
    if (n >= 10000) return Math.round(n / 10000).toLocaleString("ko-KR") + "만";
    return LC.num(n);
  };
  LC.date = function (s) {
    if (!s) return "–";
    return String(s).slice(0, 10).replace(/-/g, ".");
  };
  LC.shortDate = function (s) {
    if (!s) return "";
    var p = String(s).slice(0, 10).split("-");
    return p[0].slice(2) + "." + p[1] + "." + p[2];
  };
  LC.today = function () {
    var d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  LC.dday = function (iso) {
    if (!iso) return null;
    var t = new Date(LC.today() + "T00:00:00");
    var n = new Date(String(iso).slice(0, 10) + "T00:00:00");
    if (isNaN(n)) return null;
    return Math.round((n - t) / 86400000);
  };
  LC.ddayLabel = function (days) {
    if (days === null) return "";
    if (days < 0) return "D+" + Math.abs(days) + " 도래";
    if (days === 0) return "오늘 도래";
    return "D-" + days;
  };
  LC.esc = function (s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };
  /* 원본 데이터에 이미 이스케이프된 엔티티가 섞여 있어(&amp; 등) 한 번 풀고 다시 이스케이프합니다. */
  LC.text = function (s) {
    var raw = String(s === null || s === undefined ? "" : s)
      .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, function (m, c) {
        return { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " }[c];
      });
    return LC.esc(raw);
  };

  /* ------------------------------------------------------------------ icons */
  var P = {
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h2.2l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.9a1.6 1.6 0 0 0 1.6-1.2L21 7.4H6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.4-3.4"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    check: '<path d="m4 12.5 5 5L20 6.5"/>',
    star: '<path d="m12 3.6 2.6 5.3 5.9.85-4.25 4.14 1 5.86L12 17l-5.25 2.75 1-5.86L3.5 9.75l5.9-.85z"/>',
    filter: '<path d="M3 6h18M6.5 12h11M10 18h4"/>',
    sort: '<path d="M4 7h13M4 12h9M4 17h5"/><path d="m17 15 3 3 3-3" transform="translate(-2 -1)"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/>',
    trend: '<path d="M3 17l6-6 4 4 7-7"/><path d="M15 8h5v5"/>',
    box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="m3.5 7.5 8.5 4.5 8.5-4.5M12 12v9"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18.5V7.5A1.5 1.5 0 0 1 5.5 6H10"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><path d="M16.5 14.5h1.5"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9.5 8h5M9.5 12h5"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8v.1"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    tag: '<path d="M3.5 12.2V4.5h7.7l9.3 9.3-7.7 7.7z"/><circle cx="8" cy="8" r="1.3"/>'
  };
  LC.icon = function (name, cls) {
    return '<svg class="icon ' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[name] || "") + "</svg>";
  };
  LC.paintIcons = function (root) {
    (root || document).querySelectorAll("[data-icon]").forEach(function (el) {
      if (el.dataset.done) return;
      el.insertAdjacentHTML("afterbegin", LC.icon(el.dataset.icon, el.dataset.iconClass || ""));
      el.dataset.done = "1";
    });
  };

  /* ------------------------------------------------------------------ toast */
  var wrap = null;
  LC.toast = function (msg, ms) {
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "toast-wrap";
      wrap.setAttribute("role", "status");
      wrap.setAttribute("aria-live", "polite");
      document.body.appendChild(wrap);
    }
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity .2s";
      el.style.opacity = "0";
      setTimeout(function () { el.remove(); }, 220);
    }, ms || 2200);
  };

  /* ------------------------------------------------------------------ dropdown */
  LC.dropdown = function (root, onChange) {
    var btn = root.querySelector(".dd-btn");
    var menu = root.querySelector(".dd-menu");
    var label = btn.querySelector("[data-dd-label]");
    var api = {
      value: menu.querySelector('[aria-checked="true"]')?.dataset.value || null,
      set: function (v, silent) {
        menu.querySelectorAll(".dd-item").forEach(function (it) {
          it.setAttribute("aria-checked", it.dataset.value === v ? "true" : "false");
        });
        var it = menu.querySelector('[data-value="' + v + '"]');
        if (it && label) label.textContent = it.dataset.label || it.textContent.trim();
        api.value = v;
        if (!silent && onChange) onChange(v);
      },
      close: function () { menu.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); }
    };
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = menu.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    menu.addEventListener("click", function (e) {
      var it = e.target.closest(".dd-item");
      if (!it) return;
      api.set(it.dataset.value);
      api.close();
    });
    document.addEventListener("click", function (e) {
      if (!root.contains(e.target)) api.close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") api.close();
    });
    return api;
  };

  /* ------------------------------------------------------------------ sheet */
  var openSheets = [];
  LC.sheet = function (opts) {
    var backdrop = document.createElement("div");
    backdrop.className = "backdrop";
    var el = document.createElement("div");
    el.className = "sheet " + (opts.variant || "");
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", opts.title || "상세");
    el.innerHTML =
      '<div class="sheet-head">' +
        '<div style="flex:1 1 auto;min-width:0">' +
          '<div class="grab"></div>' +
          '<h2 class="sheet-title">' + LC.esc(opts.title || "") + "</h2>" +
          (opts.subtitle ? '<div class="muted" style="font-size:12px;font-weight:600;margin-top:2px">' + LC.esc(opts.subtitle) + "</div>" : "") +
        "</div>" +
        '<button type="button" class="sheet-close" aria-label="닫기">' + LC.icon("close") + "</button>" +
      "</div>" +
      '<div class="sheet-body"></div>' +
      (opts.footer ? '<div class="sheet-foot"></div>' : "");
    document.body.appendChild(backdrop);
    document.body.appendChild(el);
    var body = el.querySelector(".sheet-body");
    var foot = el.querySelector(".sheet-foot");
    if (opts.render) opts.render(body, api);
    if (opts.footer && foot) {
      foot.innerHTML = opts.footer;
      foot.addEventListener("click", function (e) {
        var b = e.target.closest("[data-act]");
        if (!b) return;
        if (opts.onAction) opts.onAction(b.dataset.act, b, api);
        else if (b.dataset.act === "close") api.close();
      });
    }
    var last = document.activeElement;
    var api = {
      el: el, body: body, foot: foot,
      close: function () {
        el.classList.remove("open");
        backdrop.classList.remove("open");
        document.body.classList.remove("locked");
        setTimeout(function () { el.remove(); backdrop.remove(); }, 260);
        openSheets = openSheets.filter(function (s) { return s !== api; });
        if (last && last.focus) last.focus();
        if (opts.onClose) opts.onClose();
      }
    };
    openSheets.push(api);
    el.querySelector(".sheet-close").addEventListener("click", api.close);
    backdrop.addEventListener("click", api.close);
    var onKey = function (e) {
      if (e.key === "Escape" && openSheets[openSheets.length - 1] === api) { api.close(); }
      if (e.key === "Tab") {
        var f = el.querySelectorAll('a[href],button:not([disabled]),input,textarea,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        var first = f[0], lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    var origClose = api.close;
    api.close = function () { document.removeEventListener("keydown", onKey); origClose(); };
    requestAnimationFrame(function () {
      backdrop.classList.add("open");
      el.classList.add("open");
      document.body.classList.add("locked");
      var c = el.querySelector(".sheet-close");
      if (c) c.focus({ preventScroll: true });
    });
    return api;
  };

  /* ------------------------------------------------------------------ chips */
  LC.chipGroup = function (root, onChange) {
    root.addEventListener("click", function (e) {
      var c = e.target.closest(".chip");
      if (!c || !root.contains(c)) return;
      var multi = root.dataset.multi === "true";
      if (multi) {
        c.setAttribute("aria-pressed", c.getAttribute("aria-pressed") === "true" ? "false" : "true");
      } else {
        root.querySelectorAll(".chip").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        c.setAttribute("aria-pressed", "true");
      }
      onChange(LC.chipValues(root));
    });
  };
  LC.chipValues = function (root, attr) {
    var key = attr || "value";
    return Array.prototype.filter.call(root.querySelectorAll('.chip[aria-pressed="true"]'), function (c) {
      return c.dataset[key] !== undefined && c.dataset[key] !== "";
    }).map(function (c) { return c.dataset[key]; });
  };

  /* ------------------------------------------------------------------ misc */
  LC.debounce = function (fn, ms) {
    var t;
    return function () {
      var a = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, a); }, ms || 180);
    };
  };
  LC.mediaUrl = function (base, key) {
    if (!key) return null;
    return base + key.replace(/^\/+/, "");
  };
  LC.placeholder = function (name, cls) {
    return '<div class="thumb-ph ' + (cls || "") + '">' + LC.icon(name || "box", "icon-lg") + "</div>";
  };
  LC.rating = function (r, n) {
    if (!r) return "";
    return '<span class="star">' + LC.icon("star", "icon-sm") + "</span>" +
      '<span class="tnum">' + Number(r).toFixed(1) + "</span>" +
      (n ? '<span class="muted tnum">(' + LC.compact(n) + ")</span>" : "");
  };
  LC.skeletonCards = function (n) {
    var out = "";
    for (var i = 0; i < n; i++) out += '<div class="card"><div class="card-hit">' +
      '<div class="thumb skel" style="border:0"></div><div class="card-body" style="padding-top:4px">' +
      '<div class="skel" style="height:10px;width:52px"></div>' +
      '<div class="skel" style="height:14px;width:90%;margin-top:8px"></div>' +
      '<div class="skel" style="height:14px;width:64%;margin-top:5px"></div>' +
      '<div class="skel" style="height:18px;width:44%;margin-top:12px"></div></div></div></div>';
    return out;
  };
})();
