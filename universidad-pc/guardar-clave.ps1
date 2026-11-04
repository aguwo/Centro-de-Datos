# Guarda tu RUT y tu clave del portal UCSC, cifrados con tu usuario de Windows (paso 49).
# Se corre una sola vez (o cuando cambies la clave). Solo tu usuario, en este PC, puede descifrarlos.
# Usuario = tu RUT sin puntos ni dígito verificador (ej. 21234567).
$cred = Get-Credential -Message "Portal UCSC: usuario = RUT sin puntos ni dígito verificador"
$carpeta = Join-Path $env:LOCALAPPDATA "centro-de-datos"
New-Item -ItemType Directory -Force -Path $carpeta | Out-Null
$cred | Export-Clixml (Join-Path $carpeta "ucsc.xml")
Write-Host "Guardado en $carpeta\ucsc.xml (cifrado)."
