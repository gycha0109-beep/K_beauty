[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$templateRoot = Join-Path $PSScriptRoot 'template'
$nonce = [guid]::NewGuid().ToString('N').Substring(0, 12)
$projectId = "sec09iso$nonce"
$workDir = Join-Path $env:TEMP "kbeauty-sec09-isolated-$nonce"
$supabaseDir = Join-Path $workDir 'supabase'
$started = $false
$primaryFailure = $null

. (Join-Path $templateRoot 'scripts\invoke-local-sql.ps1')

function Invoke-NativeChecked {
  param([string]$Executable, [string[]]$Arguments, [string]$Label)
  $info = [System.Diagnostics.ProcessStartInfo]::new()
  $info.FileName = $Executable
  $info.Arguments = [string]::Join(' ', ($Arguments | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' }))
  $info.UseShellExecute = $false
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $info
  try {
    if (-not $process.Start()) { throw 'process did not start' }
  } catch {
    throw "$Label could not start."
  }
  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()
  $process.WaitForExit()
  $null = $stdoutTask.GetAwaiter().GetResult()
  $null = $stderrTask.GetAwaiter().GetResult()
  if ($process.ExitCode -ne 0) { throw "$Label failed with exit code $($process.ExitCode)." }
}

function Assert-Tap {
  param([string]$Output)
  if ([string]::IsNullOrWhiteSpace($Output)) { throw 'SEC-09 TAP output is empty.' }
  if ($Output -match '(?im)^\s*(ERROR|FATAL|PANIC):|^\s*Bail out!') { throw 'SEC-09 TAP output contains a database failure.' }
  $plans = [regex]::Matches($Output, '(?m)^1\.\.(\d+)\r?$')
  if ($plans.Count -ne 1 -or [int]$plans[0].Groups[1].Value -ne 24) { throw 'SEC-09 TAP plan must be exactly 1..24 once.' }
  $assertions = [regex]::Matches($Output, '(?m)^(ok|not ok)\s+(\d+)\b')
  if ($assertions.Count -ne 24) { throw "SEC-09 observed $($assertions.Count)/24 assertions." }
  if (@($assertions | Where-Object { $_.Groups[1].Value -eq 'not ok' }).Count -ne 0) { throw 'SEC-09 TAP contains not ok.' }
  $numbers = @($assertions | ForEach-Object { [int]$_.Groups[2].Value })
  if (@($numbers | Group-Object | Where-Object Count -ne 1).Count -ne 0 -or @(1..24 | Where-Object { $numbers -notcontains $_ }).Count -ne 0) {
    throw 'SEC-09 TAP assertion numbers must be exact 1..24.'
  }
}

try {
  docker info *> $null
  if ($LASTEXITCODE -ne 0) { throw 'Docker Linux engine is unavailable.' }
  Invoke-NativeChecked -Executable 'supabase' -Arguments @('--version') -Label 'Supabase CLI preflight'

  New-Item -ItemType Directory -Force -Path (Join-Path $supabaseDir 'migrations') | Out-Null
  $config = (Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $templateRoot 'config.toml')).Replace('__SEC09_ISOLATED_PROJECT_ID__', $projectId)
  [IO.File]::WriteAllText((Join-Path $supabaseDir 'config.toml'), $config, [Text.UTF8Encoding]::new($false))
  $sec01 = '20260704221747_sec_01_analysis_request_guard.sql'
  $sec09 = '20260715000000_sec_09_result_read_rate_limit.sql'
  Copy-Item -LiteralPath (Join-Path $repoRoot "supabase\migrations\$sec01") -Destination (Join-Path $supabaseDir "migrations\$sec01")
  Copy-Item -LiteralPath (Join-Path $repoRoot "supabase\migrations\$sec09") -Destination (Join-Path $supabaseDir "migrations\$sec09")
  $sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $repoRoot "supabase\migrations\$sec09")).Hash
  $stagedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $supabaseDir "migrations\$sec09")).Hash
  if ($sourceHash -ne $stagedHash) { throw 'SEC-09 staged migration hash mismatch.' }
  Write-Output "SEC09_MIGRATION_SHA256=$sourceHash"

  Invoke-NativeChecked -Executable 'supabase' -Arguments @('--agent','no','start','--workdir',$workDir,'--exclude','studio,imgproxy,edge-runtime,logflare,vector,supavisor','--yes') -Label 'SEC-09 isolated Supabase start'
  $started = $true
  Invoke-NativeChecked -Executable 'supabase' -Arguments @('--agent','no','db','reset','--workdir',$workDir,'--local','--no-seed','--yes') -Label 'SEC-09 isolated migration reset'

  $containerId = Get-Sec09DatabaseContainerId -ProjectId $projectId
  $reapply = Invoke-Sec09Sql -ContainerId $containerId -Sql (Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $repoRoot "supabase\migrations\$sec09"))
  if ($reapply.ExitCode -ne 0) { throw 'SEC-09 corrective migration reapply failed.' }

  $tap = Invoke-Sec09Sql -ContainerId $containerId -Sql (Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $templateRoot 'tests\001_sec09_result_read_rate_limits.sql'))
  if ($tap.ExitCode -ne 0) {
    $errorCategory = @($tap.Stderr -split "`r?`n" | Where-Object { $_ -match '(?i)(ERROR|FATAL|PANIC):|^LINE\s+\d+:' } | Select-Object -First 3)
    $sanitizedCategory = if ($errorCategory.Count -gt 0) { ($errorCategory -join ' ') -replace [regex]::Escape($workDir), '<TEMP>' } else { 'database command failed' }
    throw "SEC-09 TAP psql failed with exit code $($tap.ExitCode): $sanitizedCategory"
  }
  Write-Output $tap.Stdout.TrimEnd()
  Assert-Tap -Output $tap.Stdout

  $concurrencySql = @'
set role service_role;
select public.consume_analysis_rate_limits(jsonb_build_array(jsonb_build_object('scope','anonymous','subject_hash','ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff','endpoint','result-read','window_key','concurrent','window_started_at',now(),'window_reset_at',now()+interval '1 minute','request_limit',5)));
'@
  $processes = @(1..12 | ForEach-Object { Start-Sec09SqlProcess -ContainerId $containerId -Sql $concurrencySql })
  $results = @($processes | ForEach-Object { Complete-Sec09SqlProcess -Process $_ })
  $failedWorkers = @($results | Where-Object ExitCode -ne 0)
  if ($failedWorkers.Count -ne 0) {
    $exitCodes = @($failedWorkers | ForEach-Object ExitCode | Sort-Object -Unique) -join ','
    $categories = @($failedWorkers | ForEach-Object {
      @($_.Stderr -split "`r?`n" | Where-Object { $_ -match '(?i)(ERROR|FATAL|PANIC):' } | Select-Object -First 1)
    } | Where-Object { $_ } | Sort-Object -Unique) -join ' | '
    if (-not $categories) { $categories = 'no PostgreSQL error category' }
    throw "SEC-09 concurrent workers failed: count=$($failedWorkers.Count), exitCodes=$exitCodes, categories=$categories"
  }
  $allowed = @($results | Where-Object { $_.Stdout -match '"allowed"\s*:\s*true' }).Count
  $denied = @($results | Where-Object { $_.Stdout -match '"allowed"\s*:\s*false' }).Count
  if ($allowed -ne 5 -or $denied -ne 7) { throw "SEC-09 concurrency expected 5 allowed/7 denied, observed $allowed/$denied." }
  $countResult = Invoke-Sec09Sql -ContainerId $containerId -Sql "select request_count from public.analysis_request_rate_windows where endpoint='result-read' and window_key='concurrent';"
  if ($countResult.ExitCode -ne 0 -or $countResult.Stdout.Trim() -ne '5') { throw 'SEC-09 concurrent bucket count must be exactly 5.' }
  $cleanup = Invoke-Sec09Sql -ContainerId $containerId -Sql "delete from public.analysis_request_rate_windows where endpoint='result-read'; select count(*) from public.analysis_request_rate_windows where endpoint='result-read';"
  if ($cleanup.ExitCode -ne 0 -or ($cleanup.Stdout.Trim() -split "`r?`n")[-1] -ne '0') { throw 'SEC-09 result-read residue cleanup failed.' }

  Write-Output 'SEC09_ISOLATED_TAP=24/24'
  Write-Output 'SEC09_ISOLATED_CONCURRENCY=5_ALLOWED_7_DENIED'
  Write-Output 'SEC09_ISOLATED_RESIDUE=0'
} catch {
  $primaryFailure = $_
  throw
} finally {
  $cleanupFailure = $null
  if ($started) {
    try { Invoke-NativeChecked -Executable 'supabase' -Arguments @('--agent','no','stop','--project-id',$projectId,'--no-backup') -Label 'SEC-09 isolated Supabase stop' } catch { $cleanupFailure = $_ }
  }
  try { if (Test-Path -LiteralPath $workDir) { Remove-Item -LiteralPath $workDir -Recurse -Force } } catch { if ($null -eq $cleanupFailure) { $cleanupFailure = $_ } }
  if ($null -ne $cleanupFailure) {
    if ($null -ne $primaryFailure) { Write-Warning "SEC-09 cleanup failed after primary failure: $($cleanupFailure.Exception.Message)" } else { throw $cleanupFailure }
  } else {
    Write-Output 'SEC09_ISOLATED_CLEANUP=PASS'
  }
}
