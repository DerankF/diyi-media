 = "D:\Projects\diyi-media\main-app\D&E Media.exe"
 = Start-Process -FilePath  -PassThru -WindowStyle Hidden
 = Get-Date
while (-not .HasExited -and (Get-Date) -lt .AddSeconds(20)) {
    Start-Sleep -Milliseconds 500
}
Write-Host "EXIT CODE: "
Write-Host "PID: "
Write-Host "HasExited: "

# Check for windows
 = Get-Process | Where-Object { unsetenv.MainWindowTitle -like "*Media*" -or unsetenv.MainWindowTitle -like "*D&E*" }
Write-Host "Windows found: "
foreach ( in ) {
    Write-Host "  PID= Title="
}
