# Hace que correr.ps1 se corra solo (pasos 50 y 95). Se corre una sola vez (no necesita permisos de administrador).
# Crea la tarea «Centro de datos - Universidad» en el Programador de tareas de Windows: corre cada 3 horas
# mientras el PC está prendido y, si el PC estaba apagado o suspendido a esa hora, corre apenas vuelve.
# (Antes iba en la carpeta «Inicio» y solo corría al reiniciar; si el PC se suspendía, pasaba días sin correr.)
# Para dejar de hacerlo: Unregister-ScheduledTask "Centro de datos - Universidad"
$correr = Join-Path $PSScriptRoot "correr.ps1"
$accion = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$correr`""
$cada3h = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 3)
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName "Centro de datos - Universidad" -Action $accion -Trigger $cada3h -Settings $ajustes -Force | Out-Null

# Borra el arranque viejo de la carpeta «Inicio» (paso 50), para que no corra dos veces.
Remove-Item (Join-Path ([Environment]::GetFolderPath("Startup")) "centro-de-datos-universidad.cmd") -ErrorAction SilentlyContinue
Write-Host "Listo: correrá cada 3 horas con el PC prendido. Lo último que hizo queda en $env:LOCALAPPDATA\centro-de-datos\ultima-vez.log"
