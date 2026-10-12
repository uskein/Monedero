@echo off
chcp 65001 >nul
title Monedero - PWA (web) - Vite dev server
color 0A

echo ============================================================
echo  MONEDERO - PWA (React + Vite, 100%% local, sin backend)
echo ============================================================
echo  URL:      http://localhost:5173/
echo  Detener:  Ctrl+C en esta ventana
echo.
echo  Nota: la BD hoy vive en memoria (sql.js): cada recarga
echo  empieza de cero (boveda nueva). Es esperado hasta la
echo  persistencia cifrada local (S7).
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

call pnpm --filter @monedero/web dev -- --open

echo.
echo [INFO] El servidor se ha detenido.
pause
