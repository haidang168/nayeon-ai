@echo off
echo =======================================
echo     DANG KHOI DONG NAYEON AI SERVER
echo =======================================
echo.

REM === Duong dan ngrok.exe moi nhat (3.39+) ===
set "NGROK_EXE=e:\app_speaking\ngrok-bin\ngrok.exe"
if not exist "%NGROK_EXE%" (
    echo [LOI] Khong tim thay ngrok tai %NGROK_EXE%
    echo Hay tai lai tu https://ngrok.com/download
    pause
    exit /b 1
)

REM === Buoc 1: Bat Vite Dev Server ===
echo [1/2] Dang bat Vite Server (https://localhost:3000)...
cd /d "e:\app_speaking"
start "Nayeon-Vite" cmd /k "cd /d e:\app_speaking && npm run dev"

REM === Buoc 2: Doi Vite san sang roi bat Ngrok ===
echo [2/2] Doi Vite khoi dong (8 giay)...
timeout /t 8 >nul

echo Dang bat Ngrok Tunnel...
start "Nayeon-Ngrok" cmd /k ""%NGROK_EXE%" http https://localhost:3000 --url=impure-waltz-gaining.ngrok-free.dev"

echo.
echo =======================================
echo   DA KHOI DONG THANH CONG!
echo.
echo   Tren dien thoai, vao dia chi:
echo   https://impure-waltz-gaining.ngrok-free.dev
echo.
echo   Nhan "Them vao man hinh chinh" de cai App.
echo =======================================
echo.
echo [De tat: dong 2 cua so cmd "Nayeon-Vite" va "Nayeon-Ngrok"]
pause
