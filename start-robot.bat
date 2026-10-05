@echo off
setlocal
title Robot Station
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-robot.ps1" %*
set "robotExit=%errorlevel%"
if not "%robotExit%"=="0" pause
exit /b %robotExit%
