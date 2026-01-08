# Coupang Price Tracker - Chrome Extension

쿠팡 제품 가격을 자동으로 수집하는 Chrome 확장 프로그램입니다.

## 설치 방법

1. Chrome 브라우저에서 `chrome://extensions` 입력하여 이동
2. 우측 상단 **"개발자 모드"** 토글 켜기
3. **"압축해제된 확장 프로그램을 로드합니다"** 클릭
4. `coupang-extension` 폴더 선택
5. 설치 완료!

## 사용 방법

### 자동 업데이트
1. `http://localhost:3000/coupang` 페이지 접속
2. 제품들이 등록되어 있는 상태에서 **"전체 업데이트"** 버튼 클릭
3. 확장 프로그램이 백그라운드에서 각 제품 페이지를 열어 가격 수집
4. 완료 후 자동으로 데이터 업데이트

### 수동 추출
1. 쿠팡 제품 페이지 접속
2. 확장 프로그램 아이콘 클릭
3. "현재 페이지 스크래핑" 버튼 클릭

## 파일 구조

```
coupang-extension/
├── manifest.json      # 확장 프로그램 설정
├── background.js      # 백그라운드 서비스 워커
├── content.js         # 쿠팡 페이지 데이터 추출
├── ygif-content.js    # YGIF 페이지 연동
├── popup.html         # 팝업 UI
├── popup.js           # 팝업 스크립트
└── icon*.png          # 아이콘들
```

## 주의사항

- 확장 프로그램 설치 후 페이지를 새로고침해야 content script가 로드됩니다
- 쿠팡의 봇 감지로 인해 일부 제품에서 Access Denied가 발생할 수 있습니다
- 많은 제품을 한 번에 업데이트할 경우 속도가 느릴 수 있습니다 (제품당 약 5초)
