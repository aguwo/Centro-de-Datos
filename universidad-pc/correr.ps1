# Corre el lector de la U con tu clave guardada (paso 49). La clave pasa a Node solo mientras corre.
$cred = Import-Clixml (Join-Path $env:LOCALAPPDATA "centro-de-datos\ucsc.xml")
$env:UCSC_RUT = $cred.UserName
$env:UCSC_CLAVE = $cred.GetNetworkCredential().Password
try { node (Join-Path $PSScriptRoot "leer.mjs") }
finally { Remove-Item Env:UCSC_CLAVE, Env:UCSC_RUT }
