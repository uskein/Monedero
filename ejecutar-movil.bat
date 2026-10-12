@echo off
chcp 65001 >nul
title Monedero - Movil (Expo) - Metro + QR
color 0B

echo ============================================================
echo  MONEDERO - App movil (Expo + React Native, 100%% local)
echo ============================================================
echo  1) Instala "Expo Go" en tu movil (Play Store / App Store)
echo  2) Escanea el QR que aparecera en esta ventana
echo  Atajos:  a = emulador Android   r = recargar
echo           t = tunnel (si el movil no conecta en LAN)
echo  Detener: Ctrl+C en esta ventana
echo.
echo  Nota: la persistencia cifrada nativa (SQLCipher) llegara
echo  con el dev-build; hoy la boveda usa SecureStore y los
echo  datos viven en memoria (esperado en esta fase).
echo ============================================================
echo.

cd /d "%~dp0"

where pnpm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] No se encontro "pnpm" en el PATH.
    echo         Instalalo con: npm install -g pnpm
    echo.
    pause
    exit /b 1
)

call pnpm --filter @monedero/mobile start

echo.
echo [INFO] Expo se ha detenido.
pause
