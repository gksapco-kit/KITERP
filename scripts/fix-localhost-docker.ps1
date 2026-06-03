# Fix localhost:3001 / localhost:3002 on Windows + Docker Desktop.
# Problem: localhost resolves to IPv6 (::1) but Docker publishes ports on IPv4 only.
# Solution: forward ::1 ports to 127.0.0.1 (requires Administrator once).

#Requires -RunAsAdministrator

$ErrorActionPreference = 'Stop'

$rules = @(
    @{ ListenPort = 3001; ConnectPort = 3001; Label = 'Vendor panel' },
    @{ ListenPort = 3002; ConnectPort = 3002; Label = 'Business front' },
    @{ ListenPort = 8000; ConnectPort = 8000; Label = 'Backend API' }
)

Write-Host ""
Write-Host "KITERP — fix localhost for Docker (Windows)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

foreach ($rule in $rules) {
    $listen = $rule.ListenPort
    $connect = $rule.ConnectPort
    $label = $rule.Label

    netsh interface portproxy delete v6tov4 listenport=$listen listenaddress=::1 2>$null | Out-Null
    netsh interface portproxy add v6tov4 listenport=$listen listenaddress=::1 connectport=$connect connectaddress=127.0.0.1 | Out-Null
    Write-Host "  OK  ::1:${listen} -> 127.0.0.1:${connect}  ($label)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Done. Test in your browser:" -ForegroundColor Yellow
Write-Host "  http://localhost:3001  (vendor builder)" -ForegroundColor White
Write-Host "  http://localhost:3002  (business front)" -ForegroundColor White
Write-Host ""
Write-Host "To remove these rules later:" -ForegroundColor DarkGray
Write-Host "  netsh interface portproxy delete v6tov4 listenport=3001 listenaddress=::1" -ForegroundColor DarkGray
Write-Host ""
