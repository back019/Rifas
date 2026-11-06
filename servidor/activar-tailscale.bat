@echo off
title Activar Tailscale para Rifas
set "TS=tailscale"
where tailscale >nul 2>nul
if errorlevel 1 set "TS=C:\Program Files\Tailscale\tailscale.exe"
"%TS%" version >nul 2>nul
if errorlevel 1 goto sin_tailscale

echo Publicando CouchDB (puerto 5984) dentro de tu red de Tailscale con https...
echo Si se abre una pagina pidiendo activar HTTPS o Serve, aceptala y vuelve a abrir este archivo.
echo.
"%TS%" serve --bg 5984
echo.
echo ===== Esta es la direccion para la app (la que empieza con https://) =====
"%TS%" serve status
echo.
echo Copiala en la app, en el boton de la nube, en "Direccion del servidor".
pause
exit /b 0

:sin_tailscale
echo No encontre Tailscale. Instalalo desde https://tailscale.com/download/windows, inicia sesion y vuelve a abrir este archivo.
pause
exit /b 1
