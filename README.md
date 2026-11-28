# 렛츠카트 (LetsCart) Ver 3.1

**내 구매이력 × 라이벌 가격 비교** 서비스. 자주 사는 20품목마다 내가 낸 가격·구매주기와 다나와 인기 라이벌 2종의 단위가격·스펙·주간 가격 추이를 비교합니다.
상품 DB 전체를 따라가는 대신 개인 구매이력의 해석에 집중하며, 기존 쿠팡 가격 트래커(`pyw31337/coupang`)를 `/cart`로 격상한 결과물입니다.
디자인은 칩스(CHIPS) 감성의 **라임(`#84F000`) × 딥블랙(`#111315`)** 시스템(Ver 3.1 — Minimal Visual)입니다. 설명문은 `ⓘ` 툴팁으로 옮기고, 모든 비교 카드는 **실제 상품 사진 2장(내 상품 vs 라이벌)** 을 먼저 보여 줍니다.

| 영역 | 주소 | 데이터 | 보호 |
|---|---|---|---|
| 공개 카탈로그·라이벌 | https://pyw31337.github.io/cart/ · https://letscart.pages.dev/ | `data/catalog.json` 265종 + `data/rivals.json` 20품목·60상품(다나와 실측) | 공개 |
| 가격 트래커(기존) | https://pyw31337.github.io/cart/tracker/ | `data.json` (매일 09:00 자동 갱신) | 공개 |
| 내 구매 리듬·라이벌 | https://letscart.pages.dev/my | `orders`·`order_items`·`ledger_shopping`·`ledger_matches`·`rebuy_alerts` (Cloudflare D1) + 공개 `rivals.json` 결합 | Cloudflare Access (`ywfamily.cloudflareaccess.com`) |
| 내 브라우저에서 시작하기 | https://letscart.pages.dev/local/ | 브라우저 `localStorage` + 확장 `chrome.storage` (서버 없음) | 로그인 없음 · 데이터가 기기를 떠나지 않음 |

## 구조

```
index.html            공개 카탈로그 (GitHub Pages / Cloudflare Pages 공용)
assets/lc.css         디자인 토큰 + 공용 컴포넌트 (Zero-System-UI)
assets/lc.js          시트·드로어·드롭다운·토스트·포맷 유틸
assets/rivals.js      라이벌 단위가격·스펙·가격추이 비교 컴포넌트(공용)
assets/thumbs.js      사진 없는 품목에 렛츠바이 letsbuy-thumbs R2 사진을 이름 해시로 이어 붙이는 공용 리졸버
assets/landing.js     `/` 히어로 보드·라이벌 스트립·샘플 구매이력 체험
data/rivals.json      자주 사는 20품목 × (내 상품 + 라이벌 2종) 다나와 실측 데이터
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
  api/private/*.js    summary·orders·ledger·rebuy·compare (D1, compare는 읽기 전용)
  media/[[path]].js   R2 `letscart-media` 이미지 서빙 (immutable)
  thumbs/[[path]].js  R2 `letsbuy-thumbs` 사진 서빙 (/thumbs/t/<hash>.webp, /thumbs/has?h=…)
tracker/              기존 4개 플랫폼 가격 트래커 (data.json 은 루트에 유지)
```

## 라임리 연동 피드 (`data/limery.json` · `letscart.limery.v1`)

라임리(가족 플랫폼)는 렛츠카트를 구매 기록의 정본으로 삼고, 이 피드만 읽어 상품 사진·스펙·가격 추이·판매처를 보여 줍니다.
`scripts/build_limery_feed.mjs` 가 `data/catalog.json`·`data.json`(트래커)을 합쳐 만들고, `.github/workflows/limery-feed.yml` 이 카탈로그가 바뀔 때와 매일 09:40 KST 에 다시 만듭니다.

| 필드 | 뜻 |
|---|---|
| `ids` | 카탈로그 ID + 트래커 ID(예: `농심-신라면`, `shin-ramyun`) — 두 체계를 한 상품으로 잇는다 |
| `img`, `img_source` | 다나와 사진(`danawa`) → 없으면 공유 썸네일(`thumbs`) |
| `platforms`, `main_platform` | 판매처 코드·이름·상품 링크·지금 가격 (`markets[].logo` 에 마켓 로고) |
| `purchases`, `price_history` | 내가 산 날짜·가격 / 다나와·트래커 가격 관측 |
| `spec_table`, `rating`, `reviews`, `price_url` | 제품 스펙·평점·가격 비교 링크 |
| `rebuy` | 재구매 주기·다음 날짜·목표가·최저/최고/평균가·단위 |

주소·결제수단·주문번호 같은 개인 주문 상세는 넣지 않습니다.
남은 과제: 사진이 없는 상품(약 1/3)은 맥의 `letscart/src` 수집기가 다나와 사진을 채워야 합니다.

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

## 라이벌 데이터 (`data/rivals.json`)

`letscart/src/rivals.py`가 다나와에서 실제로 수집합니다(가상 상품·가짜 가격 없음).

- 품목: 챠오 츄르, 두부모래, 우유, 신라면, 생수, 캔커피, 녹차, 식빵, 김치, 만두, 식용유, 참기름, 재래김, 식기세척기세제, 물티슈, 샴푸, 요구르트, 화장지, 치약, 섬유유연제 — **20품목**
- 상품: 품목마다 내 상품(기준) 1 + 같은 카테고리 인기 라이벌 2 = **60상품**
- 수치: 다나와 최저가·평점·리뷰·판매처 수·스펙(description 파싱)·단위가격(100g/100ml/1개/1롤/100매)·주간 최저가 추이(`price/history/tendency/graph.json`)
- 이미지: 480px WebP, SHA-256 앞 16자리 이름, `assets/media/rivals/` (참조된 60장만 유지)
- 정직성: 관측이 1회뿐이면 화면에 `관측 시작`으로 표기하고 선을 그리지 않음. 모든 값에 수집일(`observedAt`)을 기록.

```bash
cd letscart/src && python3 rivals.py            # 전체 수집(검색·상세·추이·이미지)
python3 rivals.py --only ramen,milk             # 일부만
python3 rivals.py --assemble                    # groups.json 으로 rivals.json 재조립(이미지 보정)
```

## 데이터 갱신

```bash
python3 letscart/src/export_web.py     # catalog.json + d1/*.json 재생성
python3 letscart/src/d1_seed.py        # D1 적재 (CF_API_TOKEN 필요)
```

- 카탈로그: 다나와 매칭 80종 + 반복구매 54개 상품군 + 기존 추적 39종 (총 259개 상품)
- 이미지: 168장 WebP(2.86MB) → R2 `letscart-media`, 키 `products/{sha[:2]}/{sha16}.webp`

## 썸네일 캐시 및 미디어 통합 (`letscart-media`)

렛츠바이가 렛츠카트로 통합됨에 따라, Cloudflare의 기존 `letsbuy-thumbs` 버킷 및 Worker 의존성을 제거하고 `letscart-media` R2 버킷과 `letscart.pages.dev/thumbs`로 단일화했습니다.

- 1순위는 언제나 다나와 `letscart-media` 사진(`products/{sha[:2]}/{sha16}.webp`)이고, 썸네일 캐시는 **빈 자리만** 채웁니다.
- `/my/` 재구매 카드·주문 상세, `/local/` 품목, 공개 카탈로그가 `assets/thumbs.js`를 사용합니다.
- Pages 엔드포인트를 통해 통일 서빙됩니다: `/thumbs/t/<32hex>.webp`, `/thumbs/has?h=a,b,c`, `PUT /thumbs/t/<32hex>.webp`.
- Pages 프로젝트의 `MEDIA_BUCKET` 바인딩(`letscart-media`)을 통해 R2 `thumbs/` 경로에서 직접 읽고 씁니다.
