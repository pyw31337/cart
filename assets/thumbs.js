/* 렛츠카트 — 썸네일 캐시 해석기
   렛츠카트(/my/, /local/, 공개 카탈로그)가 상품 사진을 서빙하는 모듈.
   상품명 정규화 키의 SHA-256 앞 32자리로 존재 여부 확인 후 letscart.pages.dev/thumbs 에서 읽는다.
   - 1순위는 언제나 이미 붙어 있는 다나와 `letscart-media` 사진이고, 이 모듈은 빈 자리만 채운다. */
(function (root) {
  "use strict";

  var CORE = root.LetsCartCore || root.LetsBuy || null;
  var WORKER = "https://letscart.pages.dev/thumbs";
  var API = (CORE && CORE.THUMBS) || WORKER;
  var KEY = "[data-thumbs]";
  var BATCH = 300;              // Worker /has 상한
  var STORE = "letscart.thumbs.v1";

  var yes = {};                 // hash -> true (버킷에 있음, 한 번 확인하면 계속 유효)
  var no = {};                  // hash -> 확인 시각(ms) — 없는 것은 10분만 기억한다(나중에 채워질 수 있음)
  var hashOfKey = {};           // 상품명 -> hash
  var queue = [];
  var timer = null;
  var running = false;
  var NO_TTL = 10 * 60 * 1000;

  function loadStore() {
    try {
      var raw = root.localStorage && root.localStorage.getItem(STORE);
      var j = raw ? JSON.parse(raw) : null;
      if (j && typeof j === "object") Object.keys(j).forEach(function (h) { if (j[h]) yes[h] = 1; });
    } catch (e) {}
  }
  function saveStore() {
    try {
      var ks = Object.keys(yes);
      if (ks.length > 2000) ks = ks.slice(ks.length - 2000);
      var out = {};
      ks.forEach(function (h) { out[h] = 1; });
      root.localStorage && root.localStorage.setItem(STORE, JSON.stringify(out));
    } catch (e) {}
  }

  /* 렛츠바이가 올릴 때 쓴 이름표는 '정규화 키'(core.keyOf)의 SHA-256 이다.
     상품명 원문을 그대로 해시하면 용량·옵션 표기가 달라 한 건도 맞지 않는다. */
  function hashOf(name) {
    name = String(name == null ? "" : name);
    if (!name) return Promise.resolve("");
    if (hashOfKey[name]) return Promise.resolve(hashOfKey[name]);
    var key = (CORE && CORE.keyOf) ? (CORE.keyOf(name) || name) : name;
    var p;
    if (CORE && CORE.thumbHash) p = CORE.thumbHash(key);
    else if (root.crypto && root.crypto.subtle && root.TextEncoder) {
      p = root.crypto.subtle.digest("SHA-256", new root.TextEncoder().encode(key.normalize("NFC").toLowerCase().trim()))
        .then(function (b) {
          return Array.prototype.slice.call(new Uint8Array(b), 0, 16).map(function (x) { return x.toString(16).padStart(2, "0"); }).join("");
        });
    } else p = Promise.resolve("");
    return Promise.resolve(p).then(function (h) { if (h) hashOfKey[name] = h; return h || ""; });
  }

  function query(hashes) {
    var chunks = [];
    for (var i = 0; i < hashes.length; i += BATCH) chunks.push(hashes.slice(i, i + BATCH));
    return chunks.reduce(function (p, chunk) {
      return p.then(function () {
        return fetch(API + "/has?h=" + chunk.join(","), { mode: "cors", credentials: "omit" })
          .then(function (r) { return r.ok ? r.json() : { have: [] }; })
          .then(function (j) {
            var have = {};
            (j && j.have ? j.have : []).forEach(function (h) { have[h] = 1; });
            var now = Date.now();
            chunk.forEach(function (h) { if (have[h]) { yes[h] = 1; delete no[h]; } else no[h] = now; });
          });
      });
    }, Promise.resolve()).then(saveStore);
  }

  function names(el) {
    if (el.__lcNames) return el.__lcNames;
    var list = [];
    try {
      var raw = el.getAttribute("data-thumbs") || "";
      var arr = JSON.parse(decodeURIComponent(raw));
      if (Object.prototype.toString.call(arr) !== "[object Array]") arr = [arr];
      arr.forEach(function (n) {
        n = String(n == null ? "" : n).trim();
        if (n && list.indexOf(n) < 0) list.push(n);
      });
    } catch (e) {}
    el.__lcNames = list;
    return list;
  }

  function swap(el, hash) {
    if (el.__lcDone) return;
    el.__lcDone = 1;
    el.__lcPh = el.innerHTML;
    var img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.onerror = function () {
      // 사진이 깨지면 조용히 원래 아이콘으로 되돌린다(레이아웃 유지).
      el.__lcDone = 0;
      el.innerHTML = el.__lcPh || "";
    };
    img.src = url(hash);
    el.innerHTML = "";
    el.appendChild(img);
  }

  function fill(el) {
    var list = names(el);
    for (var i = 0; i < list.length; i++) {
      var h = hashOfKey[list[i]];
      if (h && yes[h]) { swap(el, h); return; }
    }
  }

  function flush() {
    timer = null;
    if (running) return;
    var els = queue.splice(0, queue.length);
    if (!els.length) return;
    var wanted = [];
    els.forEach(function (el) {
      names(el).forEach(function (n) { if (wanted.indexOf(n) < 0) wanted.push(n); });
    });
    running = true;
    var failed = false;
    Promise.all(wanted.map(function (n) { return hashOf(n); }))
      .then(function (hs) {
        var now = Date.now(), ask = [];
        hs.forEach(function (h) {
          if (!h || yes[h]) return;
          if (no[h] && now - no[h] < NO_TTL) return;
          if (ask.indexOf(h) < 0) ask.push(h);
        });
        return ask.length ? query(ask) : null;
      })
      .catch(function () { failed = true; })
      .then(function () {
        // 취소·네트워크 오류로 한 번에 못 채워도 나머지 자리는 그대로 진행한다.
        els.forEach(function (el) { try { fill(el); } catch (e) {} });
        if (failed) els.forEach(function (el) { if (!el.__lcDone) el.__lcQueued = 0; });
      })
      .then(function () {
        running = false;
        if (queue.length && !timer) timer = setTimeout(flush, 40);
      });
  }

  /** 표시용 이미지 주소 */
  function url(hash) { return API + "/t/" + hash + ".webp"; }

  /** 사진이 없는 자리에 붙일 속성 — data-thumbs="<후보 이름들>" */
  function attr(list) {
    var out = [];
    (list || []).forEach(function (n) {
      n = String(n == null ? "" : n).trim();
      if (n && out.indexOf(n) < 0) out.push(n);
    });
    if (!out.length) return "";
    return " " + KEY.slice(1, -1) + '="' + encodeURIComponent(JSON.stringify(out.slice(0, 4))) + '"';
  }

  /** DOM 에 새로 그린 뒤 호출 — 아직 사진이 없는 자리들을 모아 한 번에 확인한다 */
  function prime(el) {
    if (!root.document) return;
    var scope = el && el.querySelectorAll ? el : root.document;
    var found = scope.querySelectorAll(KEY);
    Array.prototype.forEach.call(found, function (n) {
      if (n.__lcQueued) return;
      n.__lcQueued = 1;
      queue.push(n);
    });
    if (queue.length && !timer && !running) timer = setTimeout(flush, 40);
  }

  /** 상품명 후보 → 사진 자리 HTML (사진을 찾으면 채워지고, 못 찾으면 넘긴 아이콘이 그대로 남는다) */
  function slot(list, inner, tag, cls) {
    return "<" + (tag || "span") + (cls ? ' class="' + cls + '"' : "") + attr(list) + ">" + inner + "</" + (tag || "span") + ">";
  }

  var api = { url: url, attr: attr, prime: prime, slot: slot, hashOf: hashOf, API: API };
  root.LCThumbs = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : this);
