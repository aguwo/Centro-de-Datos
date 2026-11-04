# Hace que correr.ps1 se corra solo cada vez que prendes el PC (paso 50). Se corre una sola vez.
# Pone un archivo en la carpeta «Inicio» de Windows (no necesita permisos de administrador).
# Para dejar de hacerlo, borra ese archivo: shell:startup > centro-de-datos-universidad.cmd
$inicio = [Environment]::GetFolderPath("Startup")
$correr = Join-Path $PSScriptRoot "correr.ps1"
Set-Content (Join-Path $inicio "centro-de-datos-universidad.cmd") `
  "@powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$correr`" -AlPrender"
Write-Host "Listo: se correrá al prender el PC. Lo último que hizo queda en $env:LOCALAPPDATA\centro-de-datos\ultima-vez.log"
