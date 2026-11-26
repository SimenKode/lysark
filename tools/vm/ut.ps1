# Shows a file on the screen as pictures that the host reads off screenshots
# (tools/windows-vm.py read). Usage: powershell -ep bypass -file d:\ut.ps1 <file>
param([string]$fil)
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing -TypeDefinition (Get-Content -Raw (Join-Path $PSScriptRoot 'vis.cs'))
[LysarkShow]::SetProcessDPIAware() | Out-Null
$form = New-Object LysarkShow (, [System.IO.File]::ReadAllBytes($fil))
[System.Windows.Forms.Application]::Run($form)
