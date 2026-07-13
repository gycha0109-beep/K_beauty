[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [Parameter(Mandatory = $true)][string]$Sql,
  [switch]$TuplesOnly
)

$ErrorActionPreference = 'Stop'

function Get-IsolatedDatabaseContainer {
  param([string]$ExpectedProjectId)

  $labelMatches = @(
    docker ps --filter "label=com.supabase.cli.project=$ExpectedProjectId" --format '{{.ID}}|{{.Names}}' |
      Where-Object { $_ -match '\|.*supabase_db_' }
  )

  if ($labelMatches.Count -ne 1) {
    $nameMatches = @(
      docker ps --filter "name=^/supabase_db_$ExpectedProjectId$" --format '{{.ID}}|{{.Names}}'
    )
    if ($nameMatches.Count -ne 1) {
      throw "Expected exactly one isolated database container for project $ExpectedProjectId; found label=$($labelMatches.Count), name=$($nameMatches.Count)."
    }
    return ($nameMatches[0] -split '\|')[0]
  }

  return ($labelMatches[0] -split '\|')[0]
}

$containerId = Get-IsolatedDatabaseContainer -ExpectedProjectId $ProjectId
$arguments = @('exec', '-i', $containerId, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres')
if ($TuplesOnly) {
  $arguments += @('-A', '-t')
}

$startInfo = [System.Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = 'docker'
$startInfo.Arguments = [string]::Join(' ', ($arguments | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' }))
$startInfo.UseShellExecute = $false
$startInfo.RedirectStandardInput = $true
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true

$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $startInfo
if (-not $process.Start()) {
  throw 'Failed to start local docker psql process.'
}

$process.StandardInput.Write($Sql)
$process.StandardInput.Close()
$stdout = $process.StandardOutput.ReadToEnd()
$stderr = $process.StandardError.ReadToEnd()
$process.WaitForExit()

if ($process.ExitCode -ne 0) {
  throw "Local SQL command failed with exit code $($process.ExitCode): $stderr"
}

$stdout
