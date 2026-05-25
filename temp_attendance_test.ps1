$body = @{ resident_id = 40; scan_type = 'OUT' } | ConvertTo-Json
$in = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/attendance' -Method Post -Body $body -ContentType 'application/json'
Write-Host 'TIME_OUT_OK'
Write-Host (ConvertTo-Json $in -Depth 5)
$off = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/officials' -Method Get
$match = $off | Where-Object { $_.id -eq 40 }
if ($null -eq $match) { Write-Host 'OFFICIAL_NOT_FOUND' } else { Write-Host ('OFFICIAL_STATUS=' + $match.status) }
