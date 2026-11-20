/* 통합 가격 트래커 App (Zero System UI) — 쿠팡 · 컬리 · 지마켓 · 네이버쇼핑 */
(function () {
  const LS_CUSTOM = 'coupang_tracker_custom_v2';
  const LS_TARGETS = 'coupang_tracker_targets_v2';

  const PLATFORMS = [
    { key: 'coupang', label: '쿠팡' },
    { key: 'kurly', label: '컬리' },
    { key: 'gmarket', label: '지마켓' },
    { key: 'naver', label: '네이버쇼핑' }
  ];
  const PLATFORM_LABEL = { coupang: '쿠팡', kurly: '컬리', gmarket: '지마켓', naver: '네이버쇼핑' };
  const CTA_LABEL = { coupang: '쿠팡에서 보기', kurly: '컬리에서 보기', gmarket: '지마켓에서 보기', naver: '네이버에서 보기' };
  const ADD_CATEGORIES = ['신선·식품', '음료·커피', '반려동물', '생활·영양', '생활·패션', '내가 추가한 상품'];
  const CATEGORY_ORDER = ['신선·식품', '음료·커피', '반려동물', '생활·영양', '생활·패션'];

  let baseProducts = Array.isArray(window.__INITIAL_PRODUCTS__) ? window.__INITIAL_PRODUCTS__ : [];
  let activeFilter = '전체';
  let activePlatform = '전체';
  let selectedAddCat = '신선·식품';
  let selectedAddPlatform = 'coupang';
  let pendingEditId = null;
  let pendingDeleteId = null;
  let pendingShareText = '';
  let toastTimer = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmt(n) {
    if (n === null || n === undefined || isNaN(Number(n))) return '-';
    return Number(n).toLocaleString('ko-KR') + '원';
  }

  function platformKey(p) {
    return p.platform && PLATFORM_LABEL[p.platform] ? p.platform : 'coupang';
  }

  function platformLabel(p) {
    return PLATFORM_LABEL[platformKey(p)];
  }

  function daysUntil(dateStr) {
    if (!dateStr || dateStr === '비정기') return null;
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const todayStr = new Date(now.getTime() + kstOffset).toISOString().slice(0, 10);
    const t0 = new Date(todayStr + 'T00:00:00Z').getTime();
    const t1 = new Date(dateStr + 'T00:00:00Z').getTime();
    if (isNaN(t1)) return null;
    return Math.round((t1 - t0) / 86400000);
  }

  function isDueSoon(p) {
    const d = daysUntil(p.nextDate);
    return d !== null && d <= 14 && d >= -120;
  }

  function showToast(msg) {
    const el = document.getElementById('appToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-visible');
    }, 2400);
  }

  function getTargets() {
    try {
      return JSON.parse(localStorage.getItem(LS_TARGETS) || '{}');
    } catch (e) {
      return {};
    }
  }

  function getCustoms() {
    try {
      const arr = JSON.parse(localStorage.getItem(LS_CUSTOM) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function getAllProducts() {
    const targets = getTargets();
    const customs = getCustoms();
    return customs.concat(baseProducts).map(function (p) {
      return Object.assign({}, p, {
        platform: platformKey(p),
        platformLabel: platformLabel(p),
        targetPrice: targets[p.id] !== undefined ? targets[p.id] : p.targetPrice
      });
    });
  }

  function getStatus(p) {
    if (p.liveStatus === '품절') {
      return { cls: 'badge-soldout', key: 'soldout', text: '품절 · 재입고 대기' };
    }
    if (p.liveStatus === '판매중지') {
      return { cls: 'badge-soldout', key: 'stopped', text: '판매 중지' };
    }
    const ref = p.livePrice !== null && p.livePrice !== undefined ? p.livePrice : p.lastPrice;
    if (!ref) return { cls: 'badge-wait', key: 'wait', text: '가격 수집 대기' };
    if (ref <= p.targetPrice) {
      return {
        cls: 'badge-buy',
        key: 'buy',
        text: p.livePrice ? '현재 목표가 이하 · 매수 적기' : '직전 목표가 이하'
      };
    }
    if (p.avgPrice && ref <= p.avgPrice * 1.03) {
      return { cls: 'badge-wait', key: 'wait', text: '평균가 수준 · 대기 권장' };
    }
    return { cls: 'badge-high', key: 'high', text: '평균보다 높음 · 하락 대기' };
  }

  function buildChart(p) {
    const pts = (p.history || []).slice();
    if (p.livePrice && p.liveDate && (!pts.length || pts[pts.length - 1].date !== p.liveDate)) {
      pts.push({ date: p.liveDate, price: p.livePrice, note: '실시간 확인가' });
    }
    if (!pts.length) {
      return '<div class="chart-wrap"><div style="font-size:12px;color:var(--color-text-tertiary);padding:20px 6px;text-align:center;">수집된 가격 이력이 아직 없습니다 (목표가 ' + esc(fmt(p.targetPrice)) + ')</div></div>';
    }

    const W = 520;
    const H = 104;
    const PX = 14;
    const PY = 14;
    const vals = pts.map(function (x) { return x.price; }).concat(p.targetPrice ? [p.targetPrice] : []);
    let minV = Math.min.apply(null, vals);
    let maxV = Math.max.apply(null, vals);
    if (minV === maxV) {
      minV = Math.max(0, minV - 500);
      maxV += 500;
    }
    const pad = Math.max(100, (maxV - minV) * 0.16);
    minV = Math.max(0, minV - pad);
    maxV += pad;

    function xAt(i) {
      return pts.length === 1 ? W / 2 : PX + (i / (pts.length - 1)) * (W - PX * 2);
    }
    function yAt(v) {
      return PY + (1 - (v - minV) / (maxV - minV)) * (H - PY * 2);
    }

    const coords = pts.map(function (pt, i) {
      return { x: xAt(i), y: yAt(pt.price), date: pt.date, price: pt.price, note: pt.note || '' };
    });
    const poly = coords.map(function (c) { return c.x.toFixed(1) + ',' + c.y.toFixed(1); }).join(' ');
    const area = coords.length > 1
      ? 'M ' + coords[0].x.toFixed(1) + ',' + (H - PY) + ' L ' + coords.map(function (c) { return c.x.toFixed(1) + ',' + c.y.toFixed(1); }).join(' L ') + ' L ' + coords[coords.length - 1].x.toFixed(1) + ',' + (H - PY) + ' Z'
      : '';
    const ty = p.targetPrice ? yAt(p.targetPrice) : null;

    let svg = '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="가격 추이 그래프">';
    if (ty !== null) {
      svg += '<line x1="' + PX + '" y1="' + ty.toFixed(1) + '" x2="' + (W - PX) + '" y2="' + ty.toFixed(1) + '" stroke="#0ca678" stroke-width="1.5" stroke-dasharray="4 4" />';
    }
    if (area) svg += '<path d="' + area + '" fill="rgba(49,130,246,0.10)" />';
    if (coords.length > 1) svg += '<polyline fill="none" stroke="#3182f6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" points="' + poly + '" />';

    coords.forEach(function (c, idx) {
      const isLast = idx === coords.length - 1;
      const isLow = c.price === p.minPrice;
      const fill = isLast ? '#191f28' : isLow ? '#0ca678' : '#3182f6';
      const r = isLast || isLow ? 4.2 : 3;
      svg += '<circle class="chart-dot" data-id="' + esc(p.id) + '" data-date="' + esc(c.date) + '" data-price="' + esc(c.price) + '" data-note="' + esc(c.note) + '" cx="' + c.x.toFixed(1) + '" cy="' + c.y.toFixed(1) + '" r="' + r + '" fill="' + fill + '" stroke="#ffffff" stroke-width="1.3" style="cursor:pointer" />';
    });
    svg += '</svg>';

    const last = pts[pts.length - 1];
    return (
      '<div class="chart-wrap">' +
      '  <div class="chart-header">' +
      '    <span>구매·가격 추이 (' + pts.length + '건)</span>' +
      '    <span class="chart-target-legend tnum">--- 목표가 ' + esc(fmt(p.targetPrice)) + '</span>' +
      '  </div>' +
      svg +
      '  <div class="chart-tooltip tnum" id="tip-' + esc(p.id) + '">' +
      '    <span>최근 ' + esc(last.date) + (last.note ? ' · ' + esc(last.note) : '') + '</span>' +
      '    <strong>' + esc(fmt(last.price)) + '</strong>' +
      '  </div>' +
      '</div>'
    );
  }

  function renderPlatformTabs(all) {
    const box = document.getElementById('platformTabs');
    if (!box) return;
    const counts = { '전체': all.length };
    PLATFORMS.forEach(function (pf) { counts[pf.label] = 0; });
    all.forEach(function (p) { counts[platformLabel(p)] = (counts[platformLabel(p)] || 0) + 1; });

    const tabs = [{ key: '전체', label: '전체', cls: 'is-all', dot: null }].concat(PLATFORMS.map(function (pf) {
      return { key: pf.label, label: pf.label, cls: 'is-' + pf.key, dot: pf.key };
    }));

    box.innerHTML = tabs.map(function (t) {
      return '<button type="button" class="platform-tab ' + t.cls + (activePlatform === t.key ? ' is-active' : '') + '" data-platform="' + esc(t.key) + '" role="tab" aria-selected="' + (activePlatform === t.key) + '">' +
        (t.dot ? '<span class="platform-dot dot-' + esc(t.dot) + '"></span>' : '') +
        '<span>' + esc(t.label) + '</span>' +
        '<span class="platform-count tnum">' + (counts[t.key] || 0) + '</span>' +
        '</button>';
    }).join('');
  }

  function renderChips(all) {
    const present = {};
    all.forEach(function (p) { if (p.category) present[p.category] = true; });
    const cats = CATEGORY_ORDER.filter(function (c) { return present[c]; });
    Object.keys(present).forEach(function (c) {
      if (cats.indexOf(c) === -1) cats.push(c);
    });
    const filters = ['전체', '최저가 적기', '재구매 임박', '교차구매', '내가 추가한 상품'].concat(cats);
    document.getElementById('chipsScroll').innerHTML = filters.map(function (f) {
      return '<button type="button" class="chip ' + (activeFilter === f ? 'is-active' : '') + '" data-filter="' + esc(f) + '">' + esc(f) + '</button>';
    }).join('');
  }

  function renderCategoryPicker() {
    const box = document.getElementById('addCategoryPicker');
    if (!box) return;
    box.innerHTML = ADD_CATEGORIES.map(function (c) {
      return '<button type="button" class="picker-option ' + (selectedAddCat === c ? 'is-selected' : '') + '" data-pick-cat="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
  }

  function renderPlatformPicker() {
    const box = document.getElementById('addPlatformPicker');
    if (!box) return;
    box.innerHTML = PLATFORMS.map(function (pf) {
      return '<button type="button" class="picker-option is-platform ' + (selectedAddPlatform === pf.key ? 'is-selected' : '') + '" data-pick-platform="' + esc(pf.key) + '">' +
        '<span class="platform-dot dot-' + pf.key + '"></span>' + esc(pf.label) + '</button>';
    }).join('');
  }

  function render() {
    const all = getAllProducts();
    const searchEl = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClear');
    const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
    if (clearBtn) clearBtn.classList.toggle('visible', q.length > 0);

    document.getElementById('kpiTotal').textContent = all.length + '개';
    document.getElementById('kpiBuy').textContent = all.filter(function (p) { return getStatus(p).key === 'buy'; }).length + '개';
    document.getElementById('kpiDue').textContent = all.filter(isDueSoon).length + '개';
    const platformKpi = document.getElementById('kpiPlatforms');
    if (platformKpi) {
      platformKpi.textContent = PLATFORMS.filter(function (pf) {
        return all.some(function (p) { return platformLabel(p) === pf.label; });
      }).length + '개';
    }

    renderPlatformTabs(all);
    renderChips(all);

    const filtered = all.filter(function (p) {
      if (activePlatform !== '전체' && platformLabel(p) !== activePlatform) return false;
      if (q) {
        const hay = (p.title + ' ' + p.category + ' ' + platformLabel(p) + ' ' + (p.unitLabel || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      if (activeFilter === '전체') return true;
      if (activeFilter === '최저가 적기') return getStatus(p).key === 'buy';
      if (activeFilter === '재구매 임박') return isDueSoon(p);
      if (activeFilter === '교차구매') return !!(p.crossPlatforms && p.crossPlatforms.length > 1);
      if (activeFilter === '내가 추가한 상품') return !!p.custom;
      return p.category === activeFilter;
    });

    const grid = document.getElementById('productGrid');
    if (!filtered.length) {
      grid.innerHTML = '<div class="empty-state">조건에 맞는 추적 상품이 없습니다.</div>';
      return;
    }

    grid.innerHTML = filtered.map(function (p) {
      const st = getStatus(p);
      const d = daysUntil(p.nextDate);
      const dueBadge = d === null
        ? ''
        : (d <= 0
          ? '<span class="badge badge-high">구매 주기 도래</span>'
          : (d <= 14
            ? '<span class="badge badge-wait tnum">D-' + d + ' (' + esc(p.nextDate) + ')</span>'
            : '<span class="badge tnum">다음 ' + esc(p.nextDate) + '</span>'));

      const shown = p.livePrice !== null && p.livePrice !== undefined ? p.livePrice : p.lastPrice;
      const shownLabel = p.livePrice
        ? '실시간 확인가 (' + esc(p.liveDate) + ')' + (p.liveStatus ? ' · ' + esc(p.liveStatus) : '')
        : (p.lastDate ? '직전 구매가 (' + esc(p.lastDate) + ')' : '수집 대기');

      const pk = platformKey(p);
      const isCross = !!(p.crossPlatforms && p.crossPlatforms.length > 1);

      return (
        '<article class="product-card" data-platform-card="' + esc(pk) + '">' +
        '  <div class="badges-row">' +
        '    <span class="badge badge-platform platform-' + esc(pk) + '"><span class="platform-dot dot-' + esc(pk) + '"></span>' + esc(platformLabel(p)) + '</span>' +
        '    <span class="badge ' + st.cls + '">' + esc(st.text) + '</span>' +
        (p.custom ? '<span class="badge badge-custom">내가 추가함</span>' : '<span class="badge">' + esc(p.category) + '</span>') +
        (isCross ? '<span class="badge badge-cross">교차구매</span>' : '') +
        dueBadge +
        '  </div>' +
        '  <h2 class="product-title">' + esc(p.title) + '</h2>' +
        '  <div class="product-meta">' + esc(p.unitLabel) + (p.cycleDays ? ' · 평균 ' + p.cycleDays + '일 주기 (' + p.count + '회 구매)' : (p.count ? ' · ' + p.count + '회 구매' : '')) + '</div>' +
        (p.crossNote ? '  <p class="cross-note"><span class="cross-note-label">' + (isCross ? '타 플랫폼' : '참고') + '</span>' + esc(p.crossNote) + '</p>' : '') +
        '  <div class="price-block">' +
        '    <span class="price-current tnum">' + (shown ? esc(fmt(shown)) : '확인 전') + '</span>' +
        '    <span class="price-source">' + shownLabel + '</span>' +
        '  </div>' +
        '  <div class="stats-box">' +
        '    <div class="stat-item"><div class="stat-label">역대 최저</div><div class="stat-val is-low tnum">' + esc(fmt(p.minPrice)) + '</div></div>' +
        '    <div class="stat-item"><div class="stat-label">과거 평균</div><div class="stat-val tnum">' + esc(fmt(p.avgPrice)) + '</div></div>' +
        '    <div class="stat-item"><div class="stat-label">역대 최고</div><div class="stat-val tnum">' + esc(fmt(p.maxPrice)) + '</div></div>' +
        '    <div class="stat-item"><div class="stat-label">목표 알림가</div><div class="stat-val is-target tnum">' + esc(fmt(p.targetPrice)) + '</div></div>' +
        '  </div>' +
        buildChart(p) +
        '  <div class="card-footer">' +
        '    <div class="card-footer-left">' +
        '      <button type="button" class="btn btn-subtle btn-sm" data-edit-target="' + esc(p.id) + '">목표가 수정</button>' +
        (p.custom ? '<button type="button" class="btn btn-subtle btn-sm" data-share-req="' + esc(p.id) + '">추적 요청</button>' : '') +
        (p.custom ? '<button type="button" class="btn btn-danger-soft btn-sm" data-ask-del="' + esc(p.id) + '">삭제</button>' : '') +
        '    </div>' +
        '    <a class="btn btn-primary btn-sm" href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer">' + esc(CTA_LABEL[pk]) + '</a>' +
        '  </div>' +
        '</article>'
      );
    }).join('');
  }

  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('is-open');
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('is-open');
  }

  function setupEvents() {
    document.getElementById('btnOpenAdd').addEventListener('click', function () {
      document.getElementById('addError').classList.remove('visible');
      renderPlatformPicker();
      renderCategoryPicker();
      openModal('addModal');
    });

    document.getElementById('searchInput').addEventListener('input', render);
    document.getElementById('searchClear').addEventListener('click', function () {
      document.getElementById('searchInput').value = '';
      render();
    });

    document.addEventListener('click', function (e) {
      const closeBtn = e.target.closest('[data-close-modal]');
      if (closeBtn) {
        closeModal(closeBtn.getAttribute('data-close-modal'));
        return;
      }

      if (e.target.classList.contains('dialog-backdrop')) {
        e.target.classList.remove('is-open');
        return;
      }

      const platformBtn = e.target.closest('[data-platform]');
      if (platformBtn) {
        activePlatform = platformBtn.getAttribute('data-platform');
        render();
        return;
      }

      const filterBtn = e.target.closest('[data-filter]');
      if (filterBtn) {
        activeFilter = filterBtn.getAttribute('data-filter');
        render();
        return;
      }

      const pickPlatform = e.target.closest('[data-pick-platform]');
      if (pickPlatform) {
        selectedAddPlatform = pickPlatform.getAttribute('data-pick-platform');
        renderPlatformPicker();
        return;
      }

      const pickCat = e.target.closest('[data-pick-cat]');
      if (pickCat) {
        selectedAddCat = pickCat.getAttribute('data-pick-cat');
        renderCategoryPicker();
        return;
      }

      const editBtn = e.target.closest('[data-edit-target]');
      if (editBtn) {
        const id = editBtn.getAttribute('data-edit-target');
        const p = getAllProducts().find(function (x) { return x.id === id; });
        if (!p) return;
        pendingEditId = id;
        document.getElementById('editTargetName').textContent = p.title;
        document.getElementById('editTargetInput').value = p.targetPrice || '';
        document.getElementById('editError').classList.remove('visible');
        openModal('editTargetModal');
        return;
      }

      const delBtn = e.target.closest('[data-ask-del]');
      if (delBtn) {
        const id = delBtn.getAttribute('data-ask-del');
        const p = getAllProducts().find(function (x) { return x.id === id; });
        if (!p) return;
        pendingDeleteId = id;
        document.getElementById('deleteTargetName').textContent = p.title;
        openModal('deleteModal');
        return;
      }

      const shareBtn = e.target.closest('[data-share-req]');
      if (shareBtn) {
        const id = shareBtn.getAttribute('data-share-req');
        const p = getAllProducts().find(function (x) { return x.id === id; });
        if (!p) return;
        const plat = platformLabel(p);
        pendingShareText = '[' + plat + '] 가격 트래커에 이 상품 추가해줘: ' + p.title + ' | ' + p.url + ' | 목표가 ' + fmt(p.targetPrice);
        document.getElementById('shareReqPreview').textContent = pendingShareText;
        const ghBtn = document.getElementById('btnOpenGhIssue');
        if (ghBtn && window.__GITHUB_REPO__) {
          const issueTitle = '[추적 추가] [' + plat + '] ' + p.title;
          const issueBody = '플랫폼: ' + plat + '\n상품명: ' + p.title + '\nURL: ' + p.url + '\n목표가: ' + fmt(p.targetPrice) + '\n카테고리: ' + p.category;
          ghBtn.href = 'https://github.com/' + window.__GITHUB_REPO__ + '/issues/new?title=' + encodeURIComponent(issueTitle) + '&body=' + encodeURIComponent(issueBody) + '&labels=track-request';
        }
        openModal('shareReqModal');
        return;
      }

      const dot = e.target.closest('.chart-dot');
      if (dot) {
        const tip = document.getElementById('tip-' + dot.getAttribute('data-id'));
        if (tip) {
          const note = dot.getAttribute('data-note');
          tip.innerHTML = '<span>' + esc(dot.getAttribute('data-date')) + (note ? ' · ' + esc(note) : '') + '</span><strong>' + esc(fmt(dot.getAttribute('data-price'))) + '</strong>';
        }
      }
    });

    document.addEventListener('mouseover', function (e) {
      const dot = e.target.closest('.chart-dot');
      if (!dot) return;
      const tip = document.getElementById('tip-' + dot.getAttribute('data-id'));
      if (tip) {
        const note = dot.getAttribute('data-note');
        tip.innerHTML = '<span>' + esc(dot.getAttribute('data-date')) + (note ? ' · ' + esc(note) : '') + '</span><strong>' + esc(fmt(dot.getAttribute('data-price'))) + '</strong>';
      }
    });

    document.getElementById('btnSaveAdd').addEventListener('click', function () {
      const url = document.getElementById('fUrl').value.trim();
      const title = document.getElementById('fTitle').value.trim();
      const targetPrice = parseInt(document.getElementById('fTarget').value.replace(/[^0-9]/g, ''), 10);
      const liveRaw = document.getElementById('fLive').value.replace(/[^0-9]/g, '');
      const livePrice = liveRaw ? parseInt(liveRaw, 10) : null;
      const errEl = document.getElementById('addError');
      const plat = PLATFORM_LABEL[selectedAddPlatform];

      if (!url || !/^https?:\/\//i.test(url)) {
        errEl.textContent = '올바른 상품 URL(https://...)을 입력해 주세요.';
        errEl.classList.add('visible');
        return;
      }
      if (!title) {
        errEl.textContent = '상품명을 입력해 주세요.';
        errEl.classList.add('visible');
        return;
      }
      if (!targetPrice) {
        errEl.textContent = '목표 알림가(원)를 숫자로 입력해 주세요.';
        errEl.classList.add('visible');
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const item = {
        id: 'custom-' + Date.now(),
        custom: true,
        platform: selectedAddPlatform,
        platformLabel: plat,
        title: title,
        category: selectedAddCat,
        unitLabel: '직접 추가',
        cycleDays: null,
        nextDate: '비정기',
        targetPrice: targetPrice,
        livePrice: livePrice,
        liveDate: livePrice ? today : null,
        url: url,
        count: livePrice ? 1 : 0,
        minPrice: livePrice || targetPrice,
        maxPrice: livePrice || targetPrice,
        avgPrice: livePrice || targetPrice,
        lastPrice: livePrice || 0,
        lastDate: livePrice ? today : '',
        history: livePrice ? [{ date: today, price: livePrice, note: '초기 입력' }] : []
      };
      const customs = getCustoms();
      customs.unshift(item);
      localStorage.setItem(LS_CUSTOM, JSON.stringify(customs));
      document.getElementById('fUrl').value = '';
      document.getElementById('fTitle').value = '';
      document.getElementById('fTarget').value = '';
      document.getElementById('fLive').value = '';
      closeModal('addModal');
      activeFilter = '전체';
      showToast(plat + ' 상품을 추가했어요');
      render();
    });

    document.getElementById('btnSaveTarget').addEventListener('click', function () {
      const val = parseInt(document.getElementById('editTargetInput').value.replace(/[^0-9]/g, ''), 10);
      const errEl = document.getElementById('editError');
      if (!val || !pendingEditId) {
        errEl.textContent = '목표 금액을 1원 이상 숫자로 입력해 주세요.';
        errEl.classList.add('visible');
        return;
      }
      const targets = getTargets();
      targets[pendingEditId] = val;
      localStorage.setItem(LS_TARGETS, JSON.stringify(targets));
      closeModal('editTargetModal');
      showToast('목표가를 ' + fmt(val) + '으로 바꿨어요');
      render();
    });

    document.getElementById('btnConfirmDelete').addEventListener('click', function () {
      if (!pendingDeleteId) return;
      const customs = getCustoms().filter(function (x) { return x.id !== pendingDeleteId; });
      localStorage.setItem(LS_CUSTOM, JSON.stringify(customs));
      pendingDeleteId = null;
      closeModal('deleteModal');
      showToast('추가 상품을 삭제했어요');
      render();
    });

    document.getElementById('btnCopyShareReq').addEventListener('click', function () {
      if (!pendingShareText) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(pendingShareText).then(function () {
          closeModal('shareReqModal');
          showToast('문구를 복사했어요. 채팅에 붙여 넣어 주세요!');
        }).catch(function () {
          showToast('아래 박스를 길게 눌러 복사해 주세요');
        });
      } else {
        showToast('아래 박스를 길게 눌러 복사해 주세요');
      }
    });
  }

  setupEvents();
  render();

  fetch('../data.json')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (Array.isArray(d) && d.length) {
        baseProducts = d;
        render();
      }
    })
    .catch(function () {});
})();
