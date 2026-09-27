@echo off
title Robot Control
cd /d "%~dp0"
where node >NUL 2>NUL || (echo Node.js is not installed. Get it from https://nodejs.org & pause & exit /b)
start "" http://localhost:3000/user
node server.js
pause
