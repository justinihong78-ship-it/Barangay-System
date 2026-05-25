$res = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/residents' -Method Get
$pos = $res | Where-Object { $_.position -and $_.position.Trim() -ne '' } | Select-Object -First 1
if ($null -eq $pos) {
  Write-Host 'NO_POSITION_FOUND'
} else {
  Write-Host "ID=$($pos.id)"
  Write-Host "NAME=$($pos.full_name)"
  Write-Host "POSITION=$($pos.position)"
}
