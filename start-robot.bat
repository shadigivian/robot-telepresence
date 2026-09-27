@echo off
title Robot Station
cd /d "%~dp0"
where node >NUL 2>NUL || (echo Node.js is not installed. Get it from https://nodejs.org & pause & exit /b)
start "" http://localhost:3000/robot
node server.js --share
pause
