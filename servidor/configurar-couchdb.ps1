# Configura CouchDB para la app de Rifas: crea las bases y activa CORS.
# Se ejecuta con configurar-couchdb.bat
param([string]$Usuario, [string]$Clave)
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:5984'
Write-Host ''
Write-Host '== Configurar CouchDB para la app de Rifas ==' -ForegroundColor Cyan
Write-Host ''

try { Invoke-RestMethod -Uri "$base/" | Out-Null }
catch {
  Write-Host "No encontre CouchDB en $base." -ForegroundColor Red
  Write-Host 'Revisa que este instalado y que el servicio "Apache CouchDB" este iniciado.'
  exit 1
}

if ($Usuario) { $usuario = $Usuario } else { $usuario = Read-Host 'Usuario administrador de CouchDB (el que pusiste al instalar)' }
if ($Clave) { $clave = $Clave } else {
  $seguro = Read-Host 'Clave' -AsSecureString
  $clave = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro))
}
$auth = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${usuario}:${clave}"))
$cab = @{ Authorization = $auth }

function Llamar($metodo, $ruta, $cuerpo) {
  try {
    if ($null -ne $cuerpo) {
      Invoke-RestMethod -Method $metodo -Uri "$base$ruta" -Headers $cab -ContentType 'application/json' -Body $cuerpo | Out-Null
    } else {
      Invoke-RestMethod -Method $metodo -Uri "$base$ruta" -Headers $cab | Out-Null
    }
    return $true
  } catch {
    $codigo = 0
    if ($_.Exception.Response) { $codigo = [int]$_.Exception.Response.StatusCode }
    if ($codigo -eq 412) { return $true }   # ya existia
    if ($codigo -eq 401 -or $codigo -eq 403) {
      Write-Host 'Usuario o clave incorrectos (o ese usuario no es administrador).' -ForegroundColor Red
      exit 1
    }
    Write-Host "Error en $ruta (codigo $codigo): $($_.Exception.Message)" -ForegroundColor Yellow
    return $false
  }
}

# Comprobar que el usuario es administrador
Llamar 'GET' '/_node/_local/_config/couchdb' $null | Out-Null
Write-Host 'Conectado como administrador.' -ForegroundColor Green

# Bases del sistema (necesarias en un servidor de un solo nodo) y la base de la app
foreach ($bd in '_users', '_replicator', 'rifas') {
  if (Llamar 'PUT' "/$bd" $null) { Write-Host "Base $bd lista." }
}

# CORS: permite que la app (en el iPhone y en la PC) hable con CouchDB
$cors = [ordered]@{
  'chttpd/enable_cors' = 'true'
  'cors/origins'       = '*'
  'cors/credentials'   = 'true'
  'cors/methods'       = 'GET, PUT, POST, HEAD, DELETE'
  'cors/headers'       = 'accept, authorization, content-type, origin, referer'
}
foreach ($k in $cors.Keys) {
  $valor = '"' + $cors[$k] + '"'
  Llamar 'PUT' "/_node/_local/_config/$k" $valor | Out-Null
}
Write-Host 'CORS activado.'

Write-Host ''
Write-Host 'Listo. CouchDB esta configurado.' -ForegroundColor Green
Write-Host 'Siguiente paso: ejecuta activar-tailscale.bat para tener la direccion https.'
