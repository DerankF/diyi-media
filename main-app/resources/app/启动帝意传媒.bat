@echo off
chcp 65001 >nul
title 帝意传媒 - 启动中

cd /d "%~dp0"

echo ========================================
echo  帝意传媒 - D^&E Media
echo  新媒体管理平台
echo ========================================
echo.

:: 检查 Node.js
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

:: 检查依赖
if not exist "node_modules" (
    echo 📦 首次运行，正在安装依赖...
    call npm install
    if %errorLevel% neq 0 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
)

echo 🚀 启动应用...
call npm start

pause
