$c = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
if ($c) {
    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
    Write-Host "Killed PID $($c.OwningProcess)"
} else {
    Write-Host "port 8080 free"
}
