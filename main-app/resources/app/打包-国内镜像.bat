@echo off
chcp 65001 >nul
echo ===== 开始打包（使用国内镜像） ===== > build3.log 2>&1
cd /d "D:\融媒体发布助手\帝意传媒-mini"
echo 当前目录: %CD% >> build3.log 2>&1
echo. >> build3.log 2>&1
echo ===== 设置国内镜像 ===== >> build3.log 2>&1
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
echo ELECTRON_MIRROR=%ELECTRON_MIRROR% >> build3.log 2>&1
echo. >> build3.log 2>&1
echo ===== 运行 electron-builder ===== >> build3.log 2>&1
call node_modules\.bin\electron-builder.cmd --win --x64 >> build3.log 2>&1
echo. >> build3.log 2>&1
echo ===== 打包完成，退出码: %ERRORLEVEL% ===== >> build3.log 2>&1
