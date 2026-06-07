$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

node.exe "$root\node_modules\next\dist\bin\next" start --hostname 127.0.0.1 --port 3000
