# 렛츠카트 (LetsCart)

상품 카탈로그 + 내 지출·재구매 허브. 기존 쿠팡 가격 트래커(`pyw31337/coupang`)를 `/cart`로 격상한 2단계 결과물입니다.

| 영역 | 주소 | 데이터 | 보호 |
|---|---|---|---|
| 공개 카탈로그 | https://pyw31337.github.io/cart/ · https://letscart.pages.dev/ | `products`·`danawa_specs`·`price_history`·`rebuy_signals`·`media_assets` (공개 가능 데이터만) | 공개 |
| 가격 트래커(기존) | https://pyw31337.github.io/cart/tracker/ | `data.json` (매일 09:00 자동 갱신) | 공개 |
| 내 지출·재구매 허브 | https://letscart.pages.dev/my | `orders`·`order_items`·`ledger_shopping`·`ledger_matches`·`rebuy_alerts` (Cloudflare D1) | Cloudflare Access (`ywfamily.cloudflareaccess.com`) |
| 내 브라우저에서 시작하기 | https://letscart.pages.dev/local/ | 브라우저 `localStorage` + 확장 `chrome.storage` (서버 없음) | 로그인 없음 · 데이터가 기기를 떠나지 않음 |

## 구조

```
index.html            공개 카탈로그 (GitHub Pages / Cloudflare Pages 공용)
assets/lc.css         디자인 토큰 + 공용 컴포넌트 (Zero-System-UI)
assets/lc.js          시트·드로어·드롭다운·토스트·포맷 유틸
assets/catalog.js     카탈로그 렌더·검색·필터·상세 드로어
data/catalog.json     공개 카탈로그 데이터 (letscart/src/export_web.py 생성)
my/                   내 지출 허브 (Access 필수)
local/                로컬 모드 — 확장·.eml·붙여넣기·백업 JSON, 살 때 판정/내 소비/구매 기록
assets/engine/        렛츠바이 v0.18.3 분석 엔진 이식 (core·insights·action)
assets/logos/         14개 마켓 로고 WebP (렛츠바이 자산 → WebP 변환)
extension/            렛츠카트 수집기 v0.19.0 (MV3, 로컬-퍼스트)
tests/                `node --test` 대신 기존 러너 — `npm test`
functions/            Cloudflare Pages Functions
  _middleware.js      /my·/api/private/* 만 Access JWT(RS256) 검증
  _lib/access.js      JWKS 검증 (헤더 신뢰 없음)
  api/private/*.js    summary·orders·ledger·rebuy (D1)
  media/[[path]].js   R2 `letscart-media` 이미지 서빙 (immutable)
tracker/              기존 4개 플랫폼 가격 트래커 (data.json 은 루트에 유지)
```

## 분석 엔진 (렛츠바이 v0.18.3 이식)

`assets/engine/core.js`(메일 파싱·재구매 주기), `insights.js`(17개 카테고리 사전·단위가격·슈링크플레이션·월별 지출),
`action.js`(할인 주기 `nextDip` 예측 + 4단 행동 판정) 세 모듈로 나눴습니다. 기존 `LetsBuy`/`LetsBuyInsights`
이름도 함께 노출해 확장·백업(`letsbuy.v1`)과 호환됩니다.

| 판정 | 뜻 |
|---|---|
| 지금 사세요 | 지금 값이 내 지난 구매가·최근 평균보다 확실히 낮음 |
| 곧 떨어져요 D-n | 가격 기록에 반복되는 할인 주기가 있어 n일 뒤 내려갈 것으로 보임 |
| 기다리세요 | 지금 값이 최근 평균보다 높음 |
| 살 때 됐어요 | 구매 주기가 도래했고 값은 평소 수준 |

## 보안 경계

- 공개 저장소에는 **개인 지출·주문·가계부 행을 절대 넣지 않습니다.** `letscart.db`, `ledger_*`, `orders`, `order_items`, `rebuy_alerts`는 Git에 없습니다.
- 개인 데이터는 Cloudflare D1 `letscart`에만 있고, `/api/private/*`는 `functions/_lib/access.js`가 Access JWT의 서명·aud·exp·iss를 Workers 안에서 직접 검증한 뒤에만 응답합니다.
- 공개 경로(`/`, `/assets/*`, `/data/*`, `/tracker/*`, `/media/*`, `/local/*`)는 인증 없이 열립니다.
- `/local/`은 서버를 쓰지 않습니다. 확장이 수집한 주문·메일은 `chrome.storage.local`에만 남고, 페이지는 `localStorage`만 씁니다. 공개 카탈로그(`data/catalog.json`) 조회는 공개 상품 정보만 읽습니다.

## 데이터 갱신

```bash
python3 letscart/src/export_web.py     # catalog.json + d1/*.json 재생성
python3 letscart/src/d1_seed.py        # D1 적재 (CF_API_TOKEN 필요)
```

- 카탈로그: 다나와 매칭 80종 + 반복구매 54개 상품군 + 기존 추적 39종 (총 259개 상품)
- 이미지: 168장 WebP(2.86MB) → R2 `letscart-media`, 키 `products/{sha[:2]}/{sha16}.webp`
