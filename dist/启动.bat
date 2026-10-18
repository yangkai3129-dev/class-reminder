@echo off
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
rem 结束已经在运行的本程序（占用 8000 端口），避免更新后仍跑旧代码
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>nul
python class_reminder.py
if not errorlevel 1 goto :end
py -3 class_reminder.py
:end
pause
