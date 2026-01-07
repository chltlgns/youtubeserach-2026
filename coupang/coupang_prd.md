# PRD: Coupang Price Tracker

## 1. 제품 개요

### Product Name
**Coupang Price Tracker (CPT)**

### 목적(Objective)
쿠팡 제품 URL을 입력받아 제품 정보(가격, 할인율 등)를 추출하고, 일별 가격 변동을 추적하여 표 형태로 표시한다.

### 핵심 가치(Core Value)
- 쿠팡 제품 가격 실시간 조회
- 일별 가격 변동률 자동 계산
- 데이터 매일 오전 9시 자동 리셋

---

## 2. 기능 요구사항 (Functional Requirements)

### 2.1 URL 입력 및 데이터 추출

#### Input
- 쿠팡 제품 URL (예: `https://www.coupang.com/vp/products/...`)

#### 추출 데이터
| Field | Description | Example |
|-------|-------------|---------|
| `url` | 입력된 제품 URL | https://www.coupang.com/vp/... |
| `productName` | 제품명 | Apple 2024 맥북 프로 14 M4 |
| `finalPrice` | 최종 할인 가격 (빨간색 가격) | 2,698,360 |
| `discountRate` | 할인율 | 9% |
| `priceChangeRate` | 전일대비 가격변동율 | -5% |

### 2.2 데이터 저장 및 표시

#### Storage
- `localStorage` 사용 (브라우저 로컬 저장)
- 데이터 구조:
```typescript
interface ProductData {
  url: string;
  productName: string;
  finalPrice: number;
  originalPrice: number;
  discountRate: string;
  priceChangeRate: string;
  lastUpdated: string; // ISO date
  previousPrice?: number;
}
```

#### 테이블 표시
| URL | 제품명 | 가격 | 할인율 | 전일대비 가격변동율 |

### 2.3 데이터 리셋

#### Daily Reset
- **트리거**: 매일 오전 9시 (KST)
- **동작**: 
  1. 기존 가격 → `previousPrice`로 저장
  2. 새로운 날짜 시작

---

## 3. UI 요구사항

### 3.1 Coupang 페이지 레이아웃

```
┌─────────────────────────────────────────────────────────────┐
│ Header: YGIF            [Search][Download][Edit][Coupang]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🛒 Coupang Price Tracker                                   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  URL: [ https://www.coupang.com/...    ] [조회]      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  URL       │ 제품명      │ 가격      │할인율│변동율  │   │
│  │───────────────────────────────────────────────────────│   │
│  │  쿠팡링크  │ 맥북프로... │ 2,698,360│  9%  │  -5%  │   │
│  │  쿠팡링크  │ 아이폰...   │ 1,234,000│ 15%  │  +3%  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  마지막 리셋: 2026-01-07 09:00 KST                          │
│  [데이터 초기화] [CSV 내보내기]                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 가격 변동 표시
- **상승** (+): 빨간색 텍스트
- **하락** (-): 파란색 텍스트 (할인)
- **동일** (0%): 회색 텍스트

---

## 4. 기술 스택

### Frontend
| Technology | Purpose |
|------------|---------|
| Next.js (App Router) | 기존 YGIF와 통합 |
| TypeScript | Type Safety |
| TailwindCSS | Styling |
| localStorage | 클라이언트 데이터 저장 |

### Backend / Scraping
| Technology | Purpose |
|------------|---------|
| Next.js API Route | 서버사이드 스크래핑 |
| Cheerio | HTML 파싱 |
| Axios | HTTP 요청 |

---

## 5. 프로젝트 구조

```
youtubesearch/
├── coupang/
│   └── coupang_prd.md        # 이 문서
└── ygif/
    └── src/
        ├── app/
        │   ├── coupang/
        │   │   └── page.tsx    # Coupang 페이지
        │   └── api/
        │       └── coupang/
        │           └── route.ts # 스크래핑 API
        ├── components/
        │   └── coupang/
        │       ├── ProductInput.tsx
        │       └── ProductTable.tsx
        └── lib/
            └── coupangTypes.ts
```

---

## 6. 릴리즈 단계

### MVP
- [ ] Header에 Coupang 추가
- [ ] Coupang 페이지 생성
- [ ] URL 입력 폼
- [ ] 스크래핑 API (제품명, 가격, 할인율)
- [ ] 제품 테이블 표시
- [ ] localStorage 저장
- [ ] 전일대비 가격변동율 계산
- [ ] 매일 9시 데이터 리셋

### v1.1
- [ ] CSV 내보내기
- [ ] 가격 히스토리 차트
- [ ] 다중 제품 일괄 추가

---

## 7. 리스크 관리

| Risk | Mitigation |
|------|------------|
| 쿠팡 HTML 구조 변경 | 셀렉터 동적 감지, 에러 알림 |
| 요청 차단 (Rate Limit) | User-Agent 헤더, 요청 간격 조절 |
| localStorage 용량 제한 | 오래된 데이터 자동 삭제 |
