@echo off
chcp 65001 >nul
echo ========================================
echo  帝意传媒 - 打包安装程序
echo ========================================
echo.

:: 使用 npm 自带的 node 和 npm（无需硬编码路径）
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ 未找到 Node.js，请先安装 Node.js ^(https://nodejs.org^)
    pause
    exit /b 1
)

echo 📦 开始打包...
call npm run dist

if %errorLevel% neq 0 (
    echo ❌ 打包失败，请检查错误信息
    pause
    exit /b 1
)

echo ✅ 打包完成！
echo 📂 安装程序在 release\ 目录下
pause
