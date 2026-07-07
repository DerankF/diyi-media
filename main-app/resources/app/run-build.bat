@echo off
chcp 65001 >nul
echo ===== 开始打包 ===== > build.log 2>&1
cd /d "D:\融媒体发布助手\帝意传媒-mini"
echo 当前目录: %CD% >> build.log 2>&1
echo. >> build.log 2>&1
echo ===== 运行 electron-builder ===== >> build.log 2>&1
call node_modules\.bin\electron-builder.cmd --win --x64 >> build.log 2>&1
echo. >> build.log 2>&1
echo ===== 打包完成，退出码: %ERRORLEVEL% ===== >> build.log 2>&1
