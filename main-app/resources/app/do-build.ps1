$ErrorActionPreference = "Stop"
Write-Host "========================================"
Write-Host "  帝意传媒 - 开始打包（无交互模式）"
Write-Host "========================================"
Write-Host ""

# 设置当前进程执行策略为 Bypass
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

# 运行打包
npm run dist

Write-Host ""
Write-Host "✅ 打包完成！安装程序在 release\ 目录下"
Write-Host "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
