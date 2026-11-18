# Coupang Price Tracker (Pollcent-Style)

박영우 님의 쿠팡 구매이력(2024.09~2026.11) 기반 반복구매·관심 상품 가격 트래커 서비스입니다.

## 구조
- `index.html`, `app.js`, `styles/tokens.css`, `styles/app.css`: Zero-System-UI 웹앱 (Pretendard Variable · 320px~PC 반응형 · Safari/Chrome/Samsung Internet/Whale 크로스 브라우저 대응)
- `DESIGN_SYSTEM.md`: Toss Design System(TDS) & 당근 SEED Design System 기반 스타일 가이드
- `data.json`: 단위 보정된 구매이력 및 최신 확인 가격 데이터 (정기 스케줄을 통해 자동 업데이트)
