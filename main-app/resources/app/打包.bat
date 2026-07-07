@echo off
chcp 65001 >nul
echo ======================================
echo  帝意传媒 - 打包安装程序
echo ======================================
echo.

:: 设置 PowerShell 执行策略为绕过（仅当前进程）
powershell -Command "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; cd 'd:\融媒体发布助手\帝意传媒-mini'; npm run dist"

echo.
echo 打包完成，按任意键退出...
pause >nul
