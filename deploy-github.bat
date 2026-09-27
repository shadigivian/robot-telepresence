@echo off
title Publish robot apps
cd /d "%~dp0"
where node >NUL 2>NUL || (echo Node.js is not installed. Get it from https://nodejs.org & pause & exit /b)
where git >NUL 2>NUL || (echo Git is not installed. Get it from https://git-scm.com/download/win & pause & exit /b)
node deploy.js
pause
