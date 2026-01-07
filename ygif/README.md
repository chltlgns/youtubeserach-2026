# YGIF - YouTube Global Insight Finder

YouTube 키워드를 다국어로 번역하고, 글로벌 영상을 검색/다운로드하는 웹 애플리케이션

## 🚀 Quick Start

### 1. 환경 변수 설정

`.env` 파일에 API 키 추가:

```env
GEMINI_API_KEY=your_gemini_api_key
YOUTUBE_API_KEY=your_youtube_api_key
```

### 2. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 접속

### 3. yt-dlp 서버 실행 (다운로드 기능용)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## ✨ Features

- **🌍 키워드 번역**: Gemini AI로 6개국 언어 자동 변환
  - Iran (Persian), Pakistan (Urdu), India (Hindi)
  - Russia (Russian), Vietnam (Vietnamese), Indonesia (Indonesian)

- **🔍 YouTube 검색**: 국가별 영상 통합 검색
  - 조회수, 좋아요, 구독자 수 수집
  - 정렬 및 날짜 필터링

- **📋 URL 복사**: 개별/일괄 URL 클립보드 복사

- **⬇️ 다운로드**: yt-dlp로 영상 다운로드

- **🎨 테마**: Light / Dark / Navy 3가지 테마

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, TypeScript, TailwindCSS
- **Table**: TanStack Table
- **APIs**: Gemini 3 Flash, YouTube Data API v3
- **Backend**: Python FastAPI, yt-dlp

## 📁 Project Structure

```
ygif/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── translate/   # Gemini 번역 API
│   │   │   ├── search/      # YouTube 검색 API
│   │   │   └── download/    # 다운로드 API
│   │   ├── download/        # 다운로드 페이지
│   │   └── page.tsx         # 메인 검색 페이지
│   ├── components/          # UI 컴포넌트
│   └── lib/                 # 유틸리티
└── backend/                 # Python yt-dlp 서버
```

## 📝 License

MIT License
