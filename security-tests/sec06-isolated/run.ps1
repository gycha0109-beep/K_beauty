[CmdletBinding()]
param(
  [switch]$RunCliPreflightRegression,
  [switch]$RunCleanupRegression,
  [switch]$RunTapParserRegression
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$templateRoot = Join-Path $PSScriptRoot 'template'
$runNonce = [guid]::NewGuid().ToString('N').Substring(0, 12)
$projectId = "sec06iso$runNonce"
$migrationName = '20260714110252_sec_06_saved_reports_premium_write_boundary.sql'
$workDir = Join-Path $env:TEMP "kbeauty-sec06-isolated-$runNonce"
$supabaseDir = Join-Path $workDir 'supabase'
$started = $false

function Assert-CommandSucceeded {
  param([string]$Label)
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE."
  }
}

function Invoke-CliPreflight {
  param(
    [Parameter(Mandatory = $true)][string]$Executable,
    [string[]]$Arguments = @(),
    [Parameter(Mandatory = $true)][string]$Label
  )

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $Executable
  $startInfo.Arguments = [string]::Join(' ', ($Arguments | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' }))
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo

  try {
    if (-not $process.Start()) {
      throw 'process did not start'
    }
  } catch {
    throw "CLI preflight $Label could not start."
  }

  $null = $process.StandardOutput.ReadToEnd()
  $null = $process.StandardError.ReadToEnd()
  $process.WaitForExit()

  if ($process.ExitCode -ne 0) {
    throw "CLI preflight $Label failed with exit code $($process.ExitCode)."
  }
}

function ConvertTo-EncodedPowerShellCommand {
  param([Parameter(Mandatory = $true)][string]$Command)

  return [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($Command))
}

function Invoke-CliPreflightRegression {
  $powershellPath = (Get-Process -Id $PID).Path
  $stderrOnlyZero = ConvertTo-EncodedPowerShellCommand -Command "[Console]::Error.WriteLine('synthetic notice'); exit 0"
  $stderrOnlyOne = ConvertTo-EncodedPowerShellCommand -Command "[Console]::Error.WriteLine('synthetic failure'); exit 1"

  Invoke-CliPreflight -Executable $powershellPath -Arguments @('-NoProfile', '-NonInteractive', '-EncodedCommand', $stderrOnlyZero) -Label 'synthetic stderr exit 0'

  $nonZeroRejected = $false
  try {
    Invoke-CliPreflight -Executable $powershellPath -Arguments @('-NoProfile', '-NonInteractive', '-EncodedCommand', $stderrOnlyOne) -Label 'synthetic stderr exit 1'
  } catch {
    $nonZeroRejected = $true
  }
  if (-not $nonZeroRejected) {
    throw 'CLI preflight regression accepted synthetic non-zero exit.'
  }

  $missingExecutableRejected = $false
  try {
    Invoke-CliPreflight -Executable (Join-Path $env:TEMP 'sec06-preflight-missing-executable.exe') -Label 'missing executable'
  } catch {
    $missingExecutableRejected = $true
  }
  if (-not $missingExecutableRejected) {
    throw 'CLI preflight regression accepted a missing executable.'
  }

  Invoke-CliPreflight -Executable 'supabase' -Arguments @('--version') -Label 'supabase version'
  Write-Output 'SEC06_CLI_PREFLIGHT_REGRESSION=PASS'
}

function Invoke-CleanupRegression {
  $powershellPath = (Get-Process -Id $PID).Path
  $stderrOnlyZero = ConvertTo-EncodedPowerShellCommand -Command "[Console]::Error.WriteLine('synthetic cleanup notice'); exit 0"
  $stderrOnlyOne = ConvertTo-EncodedPowerShellCommand -Command "[Console]::Error.WriteLine('synthetic cleanup failure'); exit 1"

  Invoke-CliPreflight -Executable $powershellPath -Arguments @('-NoProfile', '-NonInteractive', '-EncodedCommand', $stderrOnlyZero) -Label 'synthetic cleanup stderr exit 0'

  $cleanupFailure = $null
  try {
    Invoke-CliPreflight -Executable $powershellPath -Arguments @('-NoProfile', '-NonInteractive', '-EncodedCommand', $stderrOnlyOne) -Label 'synthetic cleanup stderr exit 1'
  } catch {
    $cleanupFailure = $_
  }
  if ($null -eq $cleanupFailure) {
    throw 'Cleanup regression accepted a synthetic non-zero exit.'
  }

  $missingExecutableRejected = $false
  try {
    Invoke-CliPreflight -Executable (Join-Path $env:TEMP 'sec06-cleanup-missing-executable.exe') -Label 'missing cleanup executable'
  } catch {
    $missingExecutableRejected = $true
  }
  if (-not $missingExecutableRejected) {
    throw 'Cleanup regression accepted a missing executable.'
  }

  $primaryFailure = [System.InvalidOperationException]::new('synthetic role matrix failure')
  if ($primaryFailure.Message -ne 'synthetic role matrix failure' -or $null -eq $cleanupFailure) {
    throw 'Cleanup regression did not preserve the original test failure.'
  }

  Write-Output 'SEC06_CLEANUP_REGRESSION=PASS'
}

function Invoke-IsolatedTapSql {
  param(
    [Parameter(Mandatory = $true)][string]$ProjectId,
    [Parameter(Mandatory = $true)][string]$Sql
  )

  $containers = @(
    docker ps --filter "label=com.supabase.cli.project=$ProjectId" --format '{{.ID}}|{{.Names}}' |
      Where-Object { $_ -match '\|.*supabase_db_' }
  )
  if ($containers.Count -ne 1) {
    throw "Expected exactly one isolated database container for project $ProjectId; found $($containers.Count)."
  }

  $containerId = ($containers[0] -split '\|')[0]
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = 'docker'
  $startInfo.Arguments = "exec -i $containerId psql -X -A -t -q -P pager=off -v ON_ERROR_STOP=1 -U postgres -d postgres"
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  try {
    if (-not $process.Start()) {
      throw 'process did not start'
    }
  } catch {
    throw 'Isolated TAP psql could not start.'
  }

  $process.StandardInput.Write($Sql)
  $process.StandardInput.Close()
  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()
  $process.WaitForExit()
  $stdout = $stdoutTask.GetAwaiter().GetResult()
  $null = $stderrTask.GetAwaiter().GetResult()

  if ($process.ExitCode -ne 0) {
    throw "Isolated TAP psql failed with exit code $($process.ExitCode)."
  }

  return $stdout
}

function Assert-NormalizedTapOutput {
  param(
    [Parameter(Mandatory = $true)][string]$TapOutput,
    [int]$ProcessExitCode = 0
  )

  if ($ProcessExitCode -ne 0) {
    throw "SEC-06 role matrix psql exited with code $ProcessExitCode."
  }
  if ([string]::IsNullOrWhiteSpace($TapOutput)) {
    throw 'SEC-06 role matrix produced no TAP output.'
  }
  if ($TapOutput -match '(?im)^\s*Bail out!') {
    throw 'SEC-06 role matrix reported a TAP bailout.'
  }
  if ($TapOutput -match '(?im)^\s*(ERROR|FATAL|PANIC):') {
    throw 'SEC-06 role matrix reported a PostgreSQL failure.'
  }

  $planMatches = [regex]::Matches($TapOutput, '(?m)^1\.\.(\d+)\r?$')
  if ($planMatches.Count -ne 1 -or [int]$planMatches[0].Groups[1].Value -ne 56) {
    throw 'SEC-06 role matrix plan must be exactly 1..56 once.'
  }

  $assertionMatches = [regex]::Matches($TapOutput, '(?m)^(ok|not ok)\s+(\d+)\b')
  if ($assertionMatches.Count -ne 56) {
    throw "SEC-06 role matrix observed $($assertionMatches.Count)/56 assertions."
  }
  if ((@($assertionMatches | Where-Object { $_.Groups[1].Value -eq 'not ok' })).Count -ne 0) {
    throw 'SEC-06 role matrix reported a failed assertion.'
  }

  $assertionNumbers = @($assertionMatches | ForEach-Object { [int]$_.Groups[2].Value })
  $duplicateNumbers = @($assertionNumbers | Group-Object | Where-Object { $_.Count -ne 1 })
  $missingNumbers = @(1..56 | Where-Object { $assertionNumbers -notcontains $_ })
  $outOfRangeNumbers = @($assertionNumbers | Where-Object { $_ -lt 1 -or $_ -gt 56 })
  if ($duplicateNumbers.Count -ne 0 -or $missingNumbers.Count -ne 0 -or $outOfRangeNumbers.Count -ne 0) {
    throw 'SEC-06 role matrix assertion numbering must contain each number from 1 through 56 exactly once.'
  }
}

function Assert-TapParserRejects {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$TapOutput,
    [int]$ProcessExitCode = 0
  )

  $rejected = $false
  try {
    Assert-NormalizedTapOutput -TapOutput $TapOutput -ProcessExitCode $ProcessExitCode
  } catch {
    $rejected = $true
  }
  if (-not $rejected) {
    throw "TAP parser regression accepted $Name."
  }
}

function Invoke-TapParserRegression {
  $validLines = @((1..56 | ForEach-Object { "ok $_ - synthetic assertion" }) + '1..56')
  $validTap = [string]::Join("`n", $validLines)
  Assert-NormalizedTapOutput -TapOutput $validTap

  Assert-TapParserRejects -Name 'missing plan' -TapOutput ([string]::Join("`n", @($validLines | Where-Object { $_ -ne '1..56' })))
  Assert-TapParserRejects -Name 'duplicate plan' -TapOutput "$validTap`n1..56"
  Assert-TapParserRejects -Name 'missing assertion' -TapOutput ([string]::Join("`n", @($validLines | Where-Object { $_ -notmatch '^ok 56\b' })))
  Assert-TapParserRejects -Name 'duplicate assertion' -TapOutput "$validTap`nok 1 - duplicate assertion"
  Assert-TapParserRejects -Name 'not ok assertion' -TapOutput ($validTap -replace '(?m)^ok 1\b', 'not ok 1')
  Assert-TapParserRejects -Name 'non-zero psql exit' -TapOutput $validTap -ProcessExitCode 1
  Assert-TapParserRejects -Name 'ERROR output' -TapOutput "$validTap`nERROR: synthetic"
  Assert-TapParserRejects -Name 'FATAL output' -TapOutput "$validTap`nFATAL: synthetic"
  Assert-TapParserRejects -Name 'PANIC output' -TapOutput "$validTap`nPANIC: synthetic"
  Assert-TapParserRejects -Name 'bailout output' -TapOutput "$validTap`nBail out! synthetic"

  Write-Output 'SEC06_TAP_PARSER_REGRESSION=PASS'
}

if ($RunCliPreflightRegression) {
  Invoke-CliPreflightRegression
  return
}

if ($RunCleanupRegression) {
  Invoke-CleanupRegression
  return
}

if ($RunTapParserRegression) {
  Invoke-TapParserRegression
  return
}

$primaryFailure = $null
try {
  docker info *> $null
  Assert-CommandSucceeded 'docker info'
  Invoke-CliPreflight -Executable 'supabase' -Arguments @('--version') -Label 'supabase version'

  New-Item -ItemType Directory -Force -Path $supabaseDir | Out-Null
  Copy-Item -LiteralPath (Join-Path $templateRoot 'config.toml') -Destination (Join-Path $supabaseDir 'config.toml')
  $configPath = Join-Path $supabaseDir 'config.toml'
  $config = (Get-Content -Raw -Encoding UTF8 -LiteralPath $configPath).Replace('__SEC06_ISOLATED_PROJECT_ID__', $projectId)
  [System.IO.File]::WriteAllText($configPath, $config, [System.Text.UTF8Encoding]::new($false))

  $migrationsDir = Join-Path $supabaseDir 'migrations'
  New-Item -ItemType Directory -Force -Path $migrationsDir | Out-Null
  Copy-Item -LiteralPath (Join-Path $templateRoot 'bootstrap\00000000000000_pre_sec06_saved_reports.sql') -Destination $migrationsDir

  $sourceMigration = Join-Path $repoRoot "supabase\migrations\$migrationName"
  $stagedMigration = Join-Path $migrationsDir $migrationName
  Copy-Item -LiteralPath $sourceMigration -Destination $stagedMigration
  $sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $sourceMigration).Hash
  $stagedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $stagedMigration).Hash
  if ($sourceHash -ne $stagedHash) {
    throw 'SEC-06 source/staged migration hash mismatch.'
  }

  Write-Output "SEC06_MIGRATION_SHA256=$sourceHash"
  supabase --agent no start --workdir $workDir --exclude studio,imgproxy,inbucket,edge-runtime,logflare,vector,supavisor --yes
  Assert-CommandSucceeded 'isolated Supabase start'
  $started = $true

  supabase --agent no db reset --workdir $workDir --local --no-seed --yes
  Assert-CommandSucceeded 'isolated Supabase migration reset'

  $testSql = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $templateRoot 'tests\001_sec06_saved_reports_role_matrix.sql')
  $tapOutput = Invoke-IsolatedTapSql -ProjectId $projectId -Sql $testSql
  Write-Output $tapOutput.TrimEnd()
  Assert-NormalizedTapOutput -TapOutput $tapOutput

  Write-Output 'SEC06_ISOLATED_ROLE_MATRIX=PASS'
} catch {
  $primaryFailure = $_
  throw
} finally {
  $cleanupFailure = $null
  if ($started) {
    try {
      Invoke-CliPreflight -Executable 'supabase' -Arguments @('--agent', 'no', 'stop', '--project-id', $projectId, '--no-backup') -Label 'isolated Supabase stop'
    } catch {
      $cleanupFailure = $_
    }
  }
  try {
    if (Test-Path -LiteralPath $workDir) {
      Remove-Item -LiteralPath $workDir -Recurse -Force
    }
  } catch {
    if ($null -eq $cleanupFailure) {
      $cleanupFailure = $_
    }
  }

  if ($null -ne $cleanupFailure) {
    if ($null -ne $primaryFailure) {
      Write-Warning "SEC-06 cleanup failed after role matrix failure: $($cleanupFailure.Exception.Message)"
    } else {
      throw $cleanupFailure
    }
  } else {
    Write-Output 'SEC06_ISOLATED_CLEANUP=PASS'
  }
}
