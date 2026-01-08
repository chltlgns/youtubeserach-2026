@echo off
chcp 65001 > nul
echo ================================================
echo   YGIF 쿠팡 가격 트래커 시작
echo ================================================
echo.

:: Edge 프로필 경로 (기본 프로필)
:: 다른 프로필을 사용하려면 --profile-directory="Profile 1" 등으로 변경
set EDGE_PROFILE=Default

:: 먼저 개발 서버 시작
echo [1/2] Next.js 개발 서버 시작 중...
cd /d "c:\Users\campu\OneDrive\Desktop\AI\program\shortsmaker\youtubesearch\ygif"
start "YGIF Server" cmd /c "npm run dev"

:: 서버 시작 대기
echo 서버 시작 대기 중... (5초)
timeout /t 5 /nobreak > nul

:: Edge에서 YGIF 열기
echo [2/2] Edge에서 YGIF 열기...
start msedge --profile-directory="%EDGE_PROFILE%" "http://localhost:3000/coupang"

echo.
echo ================================================
echo   YGIF가 Edge에서 열렸습니다!
echo   이 창은 닫아도 됩니다.
echo ================================================
pause
