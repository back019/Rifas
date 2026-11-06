@echo off
title Crear instalador de Rifas
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instalalo desde https://nodejs.org
  pause
  exit /b 1
)
echo Instalando herramientas (la primera vez tarda unos minutos)...
call npm install
echo.
echo Creando el instalador...
call npm run instalador
echo.
echo Si todo salio bien, el instalador esta en la carpeta dist
pause
