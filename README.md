# youtubesearch

## Projects

### YGIF - YouTube Global Insight Finder
YouTube 키워드를 다국어로 번역하고, 글로벌 영상을 검색/다운로드하는 웹 애플리케이션

### Shorts Clip Editor (개발 예정)
복수 영상에서 클립을 추출하고 규칙 기반 자동 편집으로 Shorts용 영상 생성

## Quick Start

```bash
cd ygif
npm install
npm run dev
```

## Structure

```
youtubesearch/
├── prd.md         # YGIF PRD
├── edit/          # Shorts Clip Editor
│   └── prd.md     # Editor PRD
└── ygif/          # YouTube Global Insight Finder
    ├── src/
    ├── backend/   # Python yt-dlp server
    └── .env.example
```
