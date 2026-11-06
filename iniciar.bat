@echo off
title App de Rifas
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instalalo desde https://nodejs.org ^(version LTS^) y vuelve a abrir este archivo.
  pause
  exit /b 1
)
if not exist node_modules\electron (
  echo Instalando Electron por primera vez, espera un momento...
  call npm install
  if errorlevel 1 (
    echo Fallo la instalacion. Revisa tu internet y vuelve a intentar.
    pause
    exit /b 1
  )
)
call npm start
