# 쿠팡 가격 트래커 디자인 시스템 & 스타일 가이드 (Ver 1.0)

본 스타일 가이드는 **Toss Design System (TDS)**의 시맨틱 컬러·타이포그래피 위계 체계와 **당근 SEED Design System**의 4px 기반 스페이싱·토큰 명명 규칙, 그리고 **폴센트(Pollcent)**의 가격 추이·최저가 판단 UX를 결합해 설계했습니다.

---

## 1. 핵심 원칙 (Design Principles)
1. **Zero System UI**: OS/브라우저 기본 폰트(`system-ui`, `-apple-system`), 기본 `<select>`, `alert()`, `confirm()`, `prompt()`를 일체 사용하지 않습니다.
2. **Cross-Browser Uniformity**: Safari(iOS/macOS), Chrome, Samsung Internet, Naver Whale 모두에서 동일한 폰트·박스 모델·버튼 외형·스크롤·차트가 렌더되도록 웹폰트와 Appearance 리셋을 강제합니다.
3. **320px-First Fluid Grid**: 최소 가로폭 **320px**부터 데스크톱 **1280px+**까지 어떤 해상도에서도 가로 스크롤(`overflow-x`)이나 텍스트 겹침·버튼 잘림이 발생하지 않습니다.
4. **Data-First Hierarchy**: 가격 숫자는 모두 고정폭 숫자(`tabular-nums`)를 적용해 카드 간 비교 시 자릿수가 흔들리지 않게 정렬합니다.

---

## 2. 타이포그래피 (Typography — TDS & SEED 기반)

### 폰트 패밀리 (System Font 배제)
- **Primary**: `'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif` (jsDelivr Dynamic Subset CDN 로드)
- **Numeric / Price**: `font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;`
- **Scale Locking**: `-webkit-text-size-adjust: 100%; text-size-adjust: 100%;` (iOS Safari·삼성 브라우저 임의 확대 차단)

### 타입 스케일 토큰
| 토큰 | 크기 (320px / PC) | 행간 (Line Height) | 굵기 | 용도 |
|---|---|---|---|---|
| `--type-display` | 22px / 26px | 1.30 | 800 | 상단 핵심 KPI, 서비스 메인 타이틀 |
| `--type-price-lg` | 20px / 22px | 1.25 | 800 | 카드 대표 가격 (`tabular-nums`) |
| `--type-h2` | 17px / 18px | 1.35 | 700 | 모달/바텀시트 제목, 섹션 헤더 |
| `--type-title` | 15px / 16px | 1.40 | 700 | 상품 카드명 (최대 2줄 말줄임 지원) |
| `--type-body` | 14px / 14px | 1.50 | 400~500 | 입력 폼, 본문 안내 |
| `--type-sub` | 12.5px / 13px | 1.45 | 500 | 부가 설명, 주기 정보, 버튼 |
| `--type-caption` | 11px / 11.5px | 1.35 | 600 | 뱃지, 차트 축/라벨, 스탯 라벨 |

---

## 3. 컬러 시스템 (Color Tokens — TDS OKLCH 균일 명도 + SEED 팔레트)

### Neutral (표면 & 텍스트)
- `--color-bg-canvas`: `#F4F6F9` (앱 전체 배경)
- `--color-bg-surface`: `#FFFFFF` (카드, 모달, 입력창)
- `--color-bg-subtle`: `#F8F9FB` (스탯 박스, 차트 내부 배경)
- `--color-bg-hover`: `#EEF1F6` (보조 버튼 호버)
- `--color-border-default`: `#E5E8EB` (기본 1px 외곽선)
- `--color-border-strong`: `#D1D6DB` (입력창 호버·구분선)
- `--color-text-primary`: `#191F28` (주 제목, 가격)
- `--color-text-secondary`: `#4E5968` (설명, 본문)
- `--color-text-tertiary`: `#8B95A1` (라벨, 비활성)

### Semantic (의미 & 상태)
- **Brand / Action (`Blue`)**:
  - `--color-brand`: `#3182F6`
  - `--color-brand-hover`: `#1B64DA`
  - `--color-brand-weak`: `#E8F3FF`
- **Buy Signal / Lowest (`Green`)**:
  - `--color-success`: `#0CA678`
  - `--color-success-text`: `#087F5B`
  - `--color-success-weak`: `#E6FCF5`
- **Wait / Approaching (`Amber`)**:
  - `--color-warning`: `#F08C00`
  - `--color-warning-text`: `#D9480F`
  - `--color-warning-weak`: `#FFF4E6`
- **High Price / Danger (`Red`)**:
  - `--color-danger`: `#F03E3E`
  - `--color-danger-text`: `#C92A2A`
  - `--color-danger-weak`: `#FFF5F5`

---

## 4. 여백 & 레이아웃 그리드 (Spacing & Breakpoints — SEED 4px 그리드)

### 스페이싱 토큰
- `--space-1`: `4px` / `--space-1_5`: `6px` / `--space-2`: `8px` / `--space-3`: `12px` / `--space-4`: `16px` / `--space-5`: `20px` / `--space-6`: `24px` / `--space-8`: `32px`
- `--gutter-xs`: `12px` (320px~374px)
- `--gutter-sm`: `16px` (375px~767px)
- `--gutter-lg`: `24px` (768px+)

### 라운드 & 엘리베이션
- `--radius-sm`: `8px` (뱃지, 소형 버튼)
- `--radius-md`: `12px` (입력창, 스탯 박스, 칩)
- `--radius-lg`: `16px` (상품 카드, 배너)
- `--radius-xl`: `22px` (모달, 바텀시트)
- `--radius-pill`: `9999px` (필터 칩, 토스트)
- `--shadow-card`: `0 2px 10px rgba(25, 31, 40, 0.045)`
- `--shadow-modal`: `0 16px 40px rgba(25, 31, 40, 0.16)`

### 반응형 브레이크포인트 (320px 무결성 보장)
1. **320px ~ 374px (초소형 모바일 · Galaxy Fold 커버 / iPhone SE1)**
   - 좌우 패딩 `12px`, KPI 3열 대신 상단 풀폭 1열 + 하단 2열(`2-row`)로 숫자 줄바꿈 방지
   - 스탯 4칸 그리드는 **2×2 그리드**로 전환해 `역대 최저 / 평균 / 최고 / 목표가` 금액 잘림 원천 차단
   - 카드 하단 액션 버튼은 줄바꿈 시 자연 정렬, 터치 영역 최소 높이 `40px` 확보
2. **375px ~ 767px (일반 모바일)**
   - 좌우 패딩 `16px`, KPI 3열, 스탯 4열, 1열 카드 리스트
3. **768px ~ 1119px (태블릿 / 소형 랩톱)**
   - 컨테이너 최대폭 `960px`, 상품 카드 **2열 그리드** (`grid-template-columns: repeat(2, minmax(0, 1fr))`)
4. **1120px+ (PC 데스크톱)**
   - 컨테이너 최대폭 `1200px`, 상품 카드 **2~3열 유동 그리드** (`repeat(auto-fill, minmax(350px, 1fr))`), 상단 툴바 1행 통합

---

## 5. 크로스 브라우저 & Zero System UI 구현 규칙
1. **커스텀 셀렉트/피커**: 모달 내 카테고리 선택은 네이티브 `<select>` 대신 커스텀 칩/리스트 피커 버튼으로 구현.
2. **커스텀 다이얼로그**: 목표가 수정, 삭제 확인, 피클 연동 복사 안내는 모두 전용 커스텀 모달/바텀시트 + 토스트로 처리 (`alert`/`confirm`/`prompt` 미사용).
3. **Samsung Internet 다크모드/강제반전 방어**: `<meta name="color-scheme" content="light only">` 및 모든 surface에 명시적 배경·보더 선언.
4. **iOS Safari 보정**: `100dvh` 모달 최대 높이, `env(safe-area-inset-bottom)` 하단 패딩, `font-size: 16px` 입력창(포커스 시 iOS 자동 줌 방지!).
5. **터치 & 포커스**: `-webkit-tap-highlight-color: transparent`, `:focus-visible` 브랜드 컬러 아웃라인 적용.
