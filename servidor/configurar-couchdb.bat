@echo off
title Configurar CouchDB para Rifas
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0configurar-couchdb.ps1"
echo.
pause
