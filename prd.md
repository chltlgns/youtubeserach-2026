# PRD 완결본: YouTube Global Multi-Language Finder (Web)

## 1. 제품 개요

### Product Name
**YouTube Global Insight Finder (YGIF)**

### 목적(Objective)
단일 키워드 입력만으로 지정 국가의 현지 언어 표현을 자동 생성하고(Gemini 3 Flash API), YouTube 영상을 통합 검색하여 영상 URL·업로드 시점·채널 구독자·조회수 등 신뢰 지표를 웹 대시보드에서 제공한다.
추가로 사용자가 직접 입력한 URL에 대해 yt-dlp 엔진을 이용한 영상 다운로드를 지원한다.

### 핵심 가치(Core Value)
- 언어 변환 정확도 향상
- 국가별 채널 KPI 동시 확보
- 원시 URL을 활용한 후속 제작 자동화

---

## 2. 기능 요구사항 (Functional Requirements)

### 2.1 키워드 현지화 변환 – Gemini 3 Flash 기반

#### Requirement
- 사용자는 키워드 입력
- 시스템은 지정 국가 언어로 변환
  - **Iran**: Persian(Farsi)
  - **Pakistan**: Urdu
  - **India**: Hindi
  - **Russia**: Russian
  - **Vietnam**: Vietnamese
  - **Indonesia**: Indonesian
- 변환 모드는 Gemini 3 Flash Model API를 기본 사용

#### 적용 근거
- 비라틴 문자(Hindi/Urdu/Farsi) 토큰 분절 안정
- 구어체/검색 친화 표현 생성 능력
- 동의어 확장 시 문장 길이 제어 우수

#### Translation Response Schema
| Field | Description |
|-------|-------------|
| `original_query` | 원본 키워드 |
| `translated_query` | 번역된 키워드 |
| `search_synonyms[]` | 동의어 목록 |
| `confidence_score` | 신뢰도 점수 |

---

### 2.2 YouTube 검색 결과 수집 – 파일 다운로드 아닌 탐색

#### Search Module
- YouTube Data API v3 활용
- 국가별 개별 조회 후 병합

#### 수집 항목
| Field | Required | Description |
|-------|----------|-------------|
| `video_url` | ✅ 필수 | 영상 URL |
| `video_title` | ✅ | 영상 제목 |
| `upload_date` | ✅ | 업로드 날짜 |
| `view_count` | ✅ | 조회수 |
| `like_count` | ✅ | 좋아요 수 |
| `duration` | ✅ | 영상 길이 (HH:MM:SS) |
| `channel_title` | ✅ | 채널명 |
| `subscriber_count` | ✅ | 구독자 수 |
| `country` | | 국가 코드 |
| `language` | | 언어 코드 |
| `original/translated query` | | 검색 쿼리 |

---

### 2.3 URL 복사 기능

#### Requirement
- 검색된 영상의 URL은
  - 버튼 클릭 시 클립보드 복사(Copy to Clipboard)
  - 다중 선택 행 URL 일괄 복사

#### UX Flow
```
Result Table Row Select  
→ Copy URL Button  
→ Clipboard
```

---

### 2.4 사용자 입력 URL 다운로드 기능 – yt-dlp 엔진

#### Requirement
- 사용자가 URL 입력창에 주소 기입
- 시스템은 yt-dlp로 다운로드 수행
- 다운로드 정보 반환
  - 파일명
  - 포맷
  - 크기
  - 오류 로그

#### URL Download Module
- Python 기반 독립 처리
- 다운로드 경로는 설정값 기반

```
settings.download_path  
→ /country/channel/date
```

#### 제약
> [!IMPORTANT]
> - API 검색 결과의 자동 파일 저장은 지원하지 않음
> - 다운로드는 사용자 제공 URL에 한정

---

## 3. 데이터 모델 구조 (Data Requirements)

### 3.1 Tables

#### searches
| field | type | description |
|-------|------|-------------|
| id | PK | 검색 ID |
| original_query | TEXT | 입력 키워드 |
| created_at | DATETIME | 검색 시점 |

#### translated_queries
| field | type | description |
|-------|------|-------------|
| id | PK | 번역쿼리 ID |
| search_id | FK | searches 연결 |
| country_code | TEXT | 국가 |
| language_code | TEXT | 언어 |
| translated_query | TEXT | 최종 문구 |
| synonyms | JSON | 대체키워드 |
| confidence | FLOAT | 신뢰도 |

#### channels
| field | type | description |
|-------|------|-------------|
| channel_id | PK | 채널 ID |
| channel_title | TEXT | 채널명 |
| subscriber_count | INT | 구독자 |
| country_code | TEXT | 국가 |
| channel_url | TEXT | 주소 |
| last_fetched_at | DATETIME | 갱신일 |

#### videos
| field | type | description |
|-------|------|-------------|
| video_id | PK | 영상 ID |
| channel_id | FK | 채널 연결 |
| title | TEXT | 영상 제목 |
| published_at | DATE | 업로드 |
| views | INT | 조회수 |
| likes | INT | 좋아요 수 |
| duration | INT | 영상 길이 (초) |
| duration_formatted | TEXT | 영상 길이 (HH:MM:SS) |
| video_url | TEXT | 영상 URL |
| country_code | TEXT | 국가 |
| language_code | TEXT | 언어 |
| translated_query_id | FK | 번역 |
| fetched_at | DATETIME | 수집일 |

#### Indexes
- `videos(published_at)`
- `channels(subscriber_count)`
- `videos(country_code, language_code)`

---

## 4. UI 요구 (Web Application)

### 4.1 Theme System (테마 시스템)

| Theme | Background | Icon | Description |
|-------|------------|------|-------------|
| Light | 흰색 (`#FFFFFF`) | ☀️ 태양 | 밝은 모드 |
| Dark | 검정색 (`#000000`) | 🌙 달 | 다크 모드 |
| Navy | 다크 네이비 (`#0D1B2A`) | ⭐ 별 | 프리미엄 모드 |

#### Theme Switcher UI
- 헤더 우측에 테마 토글 버튼 배치
- 아이콘 클릭 시 테마 순환 전환
- LocalStorage에 사용자 선호 테마 저장
- 시스템 설정 기반 초기 테마 감지

---

### 4.2 Pages

#### Search Page
- Keyword Input
- Country Multi Toggle (체크박스/토글)
- URL Input (for download)
- Options (order/date range)

#### Results Dashboard (메인 대시보드)

> [!NOTE]
> 아래 UI는 업로드된 레퍼런스 이미지를 기반으로 설계됨

##### Header Section
```
┌─────────────────────────────────────────────────────────────────┐
│  My Videos                                    [Theme: ☀️/🌙/⭐] │
│  Showing {n} videos          YouTube API data have 2-3 day delay│
└─────────────────────────────────────────────────────────────────┘
```

##### Data Table Columns
| Column | Width | Sortable | Description |
|--------|-------|----------|-------------|
| VIDEO | 280px | ✅ | 썸네일 + 제목 |
| VIEWS | 100px | ✅ | 조회수 (숫자 포맷: 1,234) |
| LIKES | 80px | ✅ | 좋아요 수 |
| LENGTH | 80px | ✅ | 영상 길이 (MM:SS) |
| AVG VIEW DURATION (AVD) | 100px | ✅ | 평균 시청 시간 |
| AVG VIEW % (AVP) | 100px | ✅ | 평균 시청률 (색상 코딩) |
| SUBS GAINED | 80px | ✅ | 구독자 획득 |
| PUBLISHED | 120px | ✅ | 업로드 날짜 (MMM D, YYYY) |

##### AVP Color Coding
| Range | Color | Description |
|-------|-------|-------------|
| 0-50% | 🔴 Red | 낮은 시청률 |
| 50-80% | 🟡 Yellow | 보통 시청률 |
| 80-100% | 🟢 Green | 높은 시청률 |
| 100%+ | 🔵 Blue | 매우 높은 시청률 |

##### Row Features
- 체크박스 선택 (다중 선택)
- 썸네일 호버 시 미리보기
- URL 복사 버튼 (개별/일괄)
- 정렬 가능한 모든 컬럼

##### Footer
- Pagination (10/25/50/100 rows per page)
- Privacy Policy 링크

#### Download Page
- URL Input
- yt-dlp Engine
- File Download Trigger

---

## 5. 기술 스택 (Technical Proposal)

### 5.1 최종 권장

#### Frontend
| Technology | Purpose |
|------------|---------|
| Next.js (React) | Framework |
| TypeScript | Type Safety |
| TailwindCSS | Styling |
| TanStack Table | Data Grid |
| i18n | Internationalization |
| Axios | HTTP Client |

#### Backend
| Technology | Purpose |
|------------|---------|
| Node: Next Route Handler | API Routes |
| Python: FastAPI | yt-dlp Engine |
| ORM: Prisma | Database |
| Export: Papaparse / ExcelJS | Data Export |

#### Engines
| Engine | Purpose |
|--------|---------|
| Gemini 3 Flash API | Translation |
| YouTube Data API v3 | Search/Statistics |
| yt-dlp | User URL Download |

---

## 6. 릴리즈 단계

### MVP
- [x] Gemini 현지화
- [x] YouTube 검색
- [x] Dashboard
- [x] URL Copy
- [x] URL 입력 다운로드

### v1.1
- [ ] XLSX Export
- [ ] Synonyms selector

### v1.2
- [ ] RU/PK/IR 문자 보정

---

## 7. 데이터 수집 정책 (범위 명확)

> [!NOTE]
> - 검색 결과는 URL·메타데이터 수집
> - 다운로드는 사용자 입력 URL에 한정

---

## 8. 성공 KPI

| Metric | Target |
|--------|--------|
| 변환쿼리 confidence | 95%↑ |
| 비라틴 검색 정확도 | 98% |
| URL Copy success | 100% |
| Download module | 99% |

---

## 9. 리스크 관리

| Risk | Mitigation |
|------|------------|
| API quota | 사용량 모니터링 및 캐싱 |
| 국가별 품질 편차 | 언어별 테스트 케이스 |
| yt-dlp 오류 | 상세 로그 및 재시도 로직 |
