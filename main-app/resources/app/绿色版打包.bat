@echo off
chcp 65001 >nul
echo ======================================
echo  帝意传媒 - 创建完整绿色版安装包
echo ======================================
echo.

:: 设置变量
set SOURCE_DIR=%~dp0
set OUTPUT_ZIP=%~dp0帝意传媒-v1.0.0-完整绿色版.zip
set TEMP_DIR=%~dp0__package_temp__

:: 清理旧文件
if exist "%OUTPUT_ZIP%" del /q "%OUTPUT_ZIP%"
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"

:: 创建临时目录
mkdir "%TEMP_DIR%"

echo 📦 正在复制核心文件...
:: 复制核心 JS 文件
copy /y "%SOURCE_DIR%main.js" "%TEMP_DIR%\" >nul
copy /y "%SOURCE_DIR%preload.js" "%TEMP_DIR%\" >nul
copy /y "%SOURCE_DIR%ai_models.js" "%TEMP_DIR%\" >nul
copy /y "%SOURCE_DIR%automation-login.js" "%TEMP_DIR%\" >nul

:: 复制 HTML 文件
copy /y "%SOURCE_DIR%index.html" "%TEMP_DIR%\" >nul
copy /y "%SOURCE_DIR%browser-panel.html" "%TEMP_DIR%\" >nul

:: 复制图标和静态资源
copy /y "%SOURCE_DIR%icon.ico" "%TEMP_DIR%\" >nul
mkdir "%TEMP_DIR%\assets" 2>nul
copy /y "%SOURCE_DIR%assets\logo.png" "%TEMP_DIR%\assets\" >nul

:: 复制配置文件
copy /y "%SOURCE_DIR%package.json" "%TEMP_DIR%\" >nul
copy /y "%SOURCE_DIR%package-lock.json" "%TEMP_DIR%\" >nul

echo 📦 正在复制依赖（node_modules，可能需要几分钟）...
:: 复制 node_modules（所有依赖）
xcopy /e /i /q "%SOURCE_DIR%node_modules" "%TEMP_DIR%\node_modules\" 

echo 📊 正在压缩...
:: 使用 tar 创建 ZIP（Windows 10+ 内置）
cd /d "%TEMP_DIR%"
tar -a -c -f "%OUTPUT_ZIP%" *

echo 🧹 清理临时文件...
cd /d "%SOURCE_DIR%"
rmdir /s /q "%TEMP_DIR%"

echo.
echo ✅ 完整绿色版安装包创建成功！
echo   文件：%OUTPUT_ZIP%
echo.
echo 📝 安装说明：
echo   1. 解压到任意目录
echo   2. 双击 "启动帝意传媒.bat"
echo   3. 首次运行会自动检查依赖
echo.
pause
