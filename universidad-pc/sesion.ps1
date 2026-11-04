# Tu sesión del centro de datos en este PC (paso 50). La usan conectar.ps1 y correr.ps1 (se cargan con ". sesion.ps1").
# Se guarda solo la "llave para renovar" (refresh token), cifrada con tu usuario de Windows igual que la clave de la U.
# Cada vez que se usa, Supabase entrega una nueva y la anterior deja de servir, así que se vuelve a guardar.
$config = Get-Content (Join-Path $PSScriptRoot "..\docs\config.js") -Raw
$SupabaseUrl = [regex]::Match($config, 'SUPABASE_URL = "([^"]+)"').Groups[1].Value
$SupabaseLlave = [regex]::Match($config, 'SUPABASE_KEY = "([^"]+)"').Groups[1].Value
$ArchivoSesion = Join-Path $env:LOCALAPPDATA "centro-de-datos\sesion.txt"

function Guardar-Sesion($renovar) {
  New-Item -ItemType Directory -Force -Path (Split-Path $ArchivoSesion) | Out-Null
  ConvertTo-SecureString $renovar -AsPlainText -Force | ConvertFrom-SecureString | Set-Content $ArchivoSesion
}

# Devuelve un token que sirve por una hora (o $null si este PC no está conectado).
function Nuevo-Token {
  if (-not (Test-Path $ArchivoSesion)) { return $null }
  $renovar = [System.Net.NetworkCredential]::new("", (Get-Content $ArchivoSesion | ConvertTo-SecureString)).Password
  $r = Invoke-RestMethod -Method Post -Uri "$SupabaseUrl/auth/v1/token?grant_type=refresh_token" `
    -Headers @{ apikey = $SupabaseLlave } -ContentType "application/json" -Body (@{ refresh_token = $renovar } | ConvertTo-Json)
  Guardar-Sesion $r.refresh_token
  return $r.access_token
}
