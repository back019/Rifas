@echo off
title Pruebas de la app de Rifas
cd /d "%~dp0"
where node >NUL 2>NUL
if errorlevel 1 (
  echo No se encontro Node.js. Instalalo desde https://nodejs.org
  pause
  exit /b 1
)
echo Probando los calculos de la app...
node --test pruebas/
if errorlevel 1 (echo. & echo ALGUNA PRUEBA FALLO. Revisa arriba cual.) else (echo. & echo Todas las pruebas pasaron.)
pause
