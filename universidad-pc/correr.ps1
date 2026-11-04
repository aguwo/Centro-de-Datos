# Lee tus notas y tu asistencia de la U y las sube al centro de datos (pasos 49 y 50).
# La clave de la U y el token pasan a Node solo mientras corre. Lo que muestra queda también en ultima-vez.log.
# -AlPrender: lo usa el arranque de Windows (instalar.ps1): espera un minuto a que haya internet.
param([switch]$AlPrender)
if ($AlPrender) { Start-Sleep -Seconds 60 }
. (Join-Path $PSScriptRoot "sesion.ps1")
$carpeta = Join-Path $env:LOCALAPPDATA "centro-de-datos"
$cred = Import-Clixml (Join-Path $carpeta "ucsc.xml")
$env:UCSC_RUT = $cred.UserName
$env:UCSC_CLAVE = $cred.GetNetworkCredential().Password
try {
  try { $env:CENTRO_TOKEN = Nuevo-Token }
  catch { Write-Warning "No pude abrir tu sesión del centro de datos ($_). Corre conectar.ps1 otra vez." }
  node (Join-Path $PSScriptRoot "leer.mjs") 2>&1 | Tee-Object -FilePath (Join-Path $carpeta "ultima-vez.log")
}
finally { Remove-Item Env:UCSC_CLAVE, Env:UCSC_RUT, Env:CENTRO_TOKEN -ErrorAction SilentlyContinue }
