# 통합 가격 트래커 (쿠팡 · 컬리 · 지마켓 · 네이버쇼핑)

박영우 님의 4개 플랫폼 구매이력 기반 반복구매·관심 상품 가격 트래커입니다.

- 라이브: https://pyw31337.github.io/coupang/ (기존 즐겨찾기 URL 유지)
- 저장소: https://github.com/pyw31337/coupang

## 추적 범위 (2026-11-19 기준 39개)

| 플랫폼 | 추적 상품 | 구매이력 근거 |
|---|---|---|
| 쿠팡 | 15개 | 2024-09-05 ~ 2026-11-18, 유효 1,736건 / 29,200,870원 |
| 컬리 | 18개 | 2024-02-23 ~ 2026-11-10, 28주문 114라인 / 1,223,196원 (판매중지 1개 제외) |
| 지마켓 | 3개 | 2021-11-08 ~ 2026-10-05, 107묶음 132라인 / 4,839,650원 (현재 판매중 3개) |
| 네이버쇼핑 | 3개 | 2022-11-19 ~ 2026-10-15, 유효 148건 중 쇼핑 82건 / 4,100,531원 |

옥션은 사용자 결정(2026-11-19)에 따라 이번 통합에서 제외했습니다. 교차 구매 분석은 `analysis/multi-platform-repeat-analysis.md`에 정리했습니다.

## 구조

- `index.html`, `app.js`, `styles/tokens.css`, `styles/app.css`: Zero-System-UI 웹앱 (Pretendard Variable · 320px~PC 반응형 · Safari/Chrome/Samsung Internet/Whale 크로스 브라우저 대응)
- `DESIGN_SYSTEM.md`: Toss Design System(TDS) & 당근 SEED Design System 기반 스타일 가이드
- `data.json`: 4개 플랫폼 단위 보정 구매이력·최신 확인가 데이터 (정기 스케줄을 통해 자동 업데이트)

## 데이터 규칙

- 모든 상품은 `platform`(`coupang`·`kurly`·`gmarket`·`naver`)과 `platformLabel`(쿠팡·컬리·지마켓·네이버쇼핑)을 가집니다.
- `minPrice`/`maxPrice`/`avgPrice`/`lastPrice`는 `history`(단위 보정 구매·확인가)에서 계산합니다.
- `livePrice`/`liveDate`: 2026-11-19 실시간 확인가. `liveStatus`가 `품절`·`판매중지`이면 가격이 목표가 이하여도 '매수 적기'로 판정하지 않습니다.
- `crossPlatforms`·`crossNote`: 같은 상품(또는 같은 브랜드 계열)을 다른 플랫폼에서도 산 경우의 교차 구매 표시입니다.
- CTA 버튼은 플랫폼에 따라 `쿠팡에서 보기` / `컬리에서 보기` / `지마켓에서 보기` / `네이버에서 보기`로 바뀝니다.
