@echo off
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
python class_reminder.py
if not errorlevel 1 goto :end
py -3 class_reminder.py
:end
pause
