# Conecta este PC a tu centro de datos (paso 50). Se corre una sola vez.
# Te llega el mismo correo con enlace que usas para entrar a la web. NO hagas clic en el enlace:
# cópialo (clic derecho > Copiar dirección del enlace) y pégalo aquí. Este script lo abre sin navegador
# y guarda la sesión cifrada en este PC. Si lo abriste por error, corre esto de nuevo.
. (Join-Path $PSScriptRoot "sesion.ps1")
Add-Type -AssemblyName System.Net.Http

$correo = Read-Host "Tu correo del centro de datos"
Invoke-RestMethod -Method Post -Uri "$SupabaseUrl/auth/v1/otp" -Headers @{ apikey = $SupabaseLlave } `
  -ContentType "application/json" -Body (@{ email = $correo; create_user = $false } | ConvertTo-Json) | Out-Null
$enlace = Read-Host "Te mandé un correo. Copia el enlace (sin abrirlo) y pégalo aquí"

# El enlace responde con una redirección que trae la sesión después del «#». No se sigue: solo se lee.
$manejo = New-Object System.Net.Http.HttpClientHandler
$manejo.AllowAutoRedirect = $false
$destino = (New-Object System.Net.Http.HttpClient($manejo)).GetAsync($enlace.Trim()).Result.Headers.Location
$renovar = [regex]::Match([string]$destino, 'refresh_token=([^&]+)').Groups[1].Value
if (-not $renovar) { throw "El enlace no sirvió (¿ya lo habías abierto?). Corre conectar.ps1 otra vez." }
Guardar-Sesion $renovar
Write-Host "Listo: este PC quedó conectado. Desde ahora correr.ps1 sube tus notas y tu asistencia."
