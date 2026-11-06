@echo off
title Publicar app de rifas en GitHub
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 goto sin_git

git config user.email >nul 2>nul
if errorlevel 1 goto pedir_identidad
goto revisar_repo

:pedir_identidad
echo Git necesita tu nombre y correo para guardar los cambios (solo la primera vez).
set /p GNOMBRE=Tu nombre: 
set /p GCORREO=Tu correo de GitHub: 
git config --global user.name "%GNOMBRE%"
git config --global user.email "%GCORREO%"

:revisar_repo
if exist .git goto subir
echo.
echo Primera vez: pega la direccion de tu repositorio vacio de GitHub.
echo Ejemplo: https://github.com/tu-usuario/rifas.git
set /p REPO=Direccion: 
git init -b main
git remote add origin %REPO%
rem Si el repositorio ya tiene archivos, se toma su historial sin tocar los archivos de esta carpeta
git fetch origin main >nul 2>nul
if not errorlevel 1 git reset origin/main >nul

:subir
rem El archivo de publicacion de GitHub Pages va en .github\workflows
if not exist .github\workflows mkdir .github\workflows
copy /y config-github\pages.yml .github\workflows\pages.yml >nul
git add -A
git commit -m "Actualizar app de rifas"
git push -u origin main
if errorlevel 1 goto error_push
echo.
echo Listo. En 1 o 2 minutos se actualiza la pagina en GitHub Pages.
pause
exit /b 0

:error_push
echo.
echo No se pudo subir. Revisa la direccion del repositorio y que iniciaste sesion en GitHub.
pause
exit /b 1

:sin_git
echo No se encontro Git. Instalalo desde https://git-scm.com/download/win y vuelve a abrir este archivo.
pause
exit /b 1
