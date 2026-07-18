[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [Parameter(Mandatory = $true)][string]$EvidencePath,
  [Parameter(Mandatory = $true)][string]$StructuredEvidencePath,
  [switch]$RunTimeoutRegression,
  [ValidateRange(1, 10)][int]$TestWorkerTimeoutSeconds = 1
)

$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Get-IsolatedDatabaseContainer {
  $labelMatches = @(
    docker ps --filter "label=com.supabase.cli.project=$ProjectId" --format '{{.ID}}|{{.Names}}' |
      Where-Object { $_ -match '\|.*supabase_db_' }
  )
  if ($labelMatches.Count -eq 1) { return ($labelMatches[0] -split '\|')[0] }

  $nameMatches = @(docker ps --filter "name=^/supabase_db_$ProjectId$" --format '{{.ID}}|{{.Names}}')
  if ($nameMatches.Count -ne 1) {
    throw "Expected exactly one isolated database container for project $ProjectId; found label=$($labelMatches.Count), name=$($nameMatches.Count)."
  }
  return ($nameMatches[0] -split '\|')[0]
}

$dbContainer = $null

function Invoke-ContainerSql {
  param([Parameter(Mandatory = $true)][string]$Sql)

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = 'docker'
  $arguments = @('exec', '-i', $dbContainer, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-U', 'postgres', '-d', 'postgres')
  $startInfo.Arguments = [string]::Join(' ', ($arguments | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' }))
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  if (-not $process.Start()) { throw 'Unable to start local psql worker.' }
  $process.StandardInput.Write($Sql)
  $process.StandardInput.Close()
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  if (-not $process.WaitForExit(30000)) {
    $process.Kill($true)
    throw 'Local psql worker timed out.'
  }
  if ($process.ExitCode -ne 0) { throw "Local psql worker failed: $stderr" }
  return $stdout.Trim()
}

function Invoke-ConcurrentSql {
  param(
    [Parameter(Mandatory = $true)][string[]]$SqlStatements,
    [Parameter(Mandatory = $true)][string]$Scenario,
    [ValidateRange(1, 60)][int]$WorkerTimeoutSeconds = 30,
    [switch]$UseSleepTestProcess
  )

  $jobs = @()
  try {
    $workerIndex = 0
    foreach ($statement in $SqlStatements) {
      $workerIndex++
      $jobs += Start-Job -Name "$Scenario-$workerIndex" -ScriptBlock {
        param($ContainerId, $Sql, $WorkerIndex, $WorkerTimeoutSeconds, $UseSleepTestProcess)
        try {
          $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
          if ($UseSleepTestProcess) {
            $startInfo.FileName = (Get-Command powershell -CommandType Application -ErrorAction Stop).Source
            $args = @('-NoProfile', '-Command', 'Start-Sleep -Seconds 5')
          } else {
            $startInfo.FileName = 'docker'
            $args = @('exec', '-i', $ContainerId, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-U', 'postgres', '-d', 'postgres')
          }
          $startInfo.Arguments = [string]::Join(' ', ($args | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' }))
          $startInfo.UseShellExecute = $false
          $startInfo.RedirectStandardInput = $true
          $startInfo.RedirectStandardOutput = $true
          $startInfo.RedirectStandardError = $true
          $process = [System.Diagnostics.Process]::new()
          $process.StartInfo = $startInfo
          if (-not $process.Start()) {
            return [pscustomobject]@{ WorkerIndex = $WorkerIndex; ExitCode = -1; TimedOut = $false; Stdout = ''; Stderr = 'Unable to start concurrent psql worker.' }
          }
          $process.StandardInput.Write($Sql)
          $process.StandardInput.Close()
          $stdoutTask = $process.StandardOutput.ReadToEndAsync()
          $stderrTask = $process.StandardError.ReadToEndAsync()
          $timedOut = -not $process.WaitForExit($WorkerTimeoutSeconds * 1000)
          if ($timedOut) {
            try {
              & taskkill.exe /PID $process.Id /T /F | Out-Null
            } catch {
              try { $process.Kill() } catch {}
            }
            $process.WaitForExit()
          }
          $stdout = $stdoutTask.GetAwaiter().GetResult()
          $stderr = $stderrTask.GetAwaiter().GetResult()
          return [pscustomobject]@{ WorkerIndex = $WorkerIndex; ExitCode = if ($timedOut) { -1 } else { $process.ExitCode }; TimedOut = $timedOut; Stdout = $stdout; Stderr = $stderr }
        } catch {
          return [pscustomobject]@{ WorkerIndex = $WorkerIndex; ExitCode = -1; TimedOut = $false; Stdout = ''; Stderr = $_.Exception.Message }
        }
      } -ArgumentList $dbContainer, $statement, $workerIndex, $WorkerTimeoutSeconds, $UseSleepTestProcess
    }

    $null = Wait-Job -Job $jobs -Timeout 45
    $unfinished = @($jobs | Where-Object { $_.State -ne 'Completed' })
    if ($unfinished.Count -gt 0) {
      $unfinished | Stop-Job -ErrorAction SilentlyContinue
      $completed = @($jobs | Where-Object { $_.State -eq 'Completed' } | ForEach-Object { Receive-Job -Job $_ -ErrorAction Stop })
      $timedOut = @($unfinished | ForEach-Object {
        $workerIndex = [int](($_.Name -split '-')[-1])
        [pscustomobject]@{ WorkerIndex = $workerIndex; ExitCode = -1; TimedOut = $true; Stdout = ''; Stderr = '' }
      })
      return @($completed + $timedOut | Sort-Object WorkerIndex)
    }
    return @($jobs | ForEach-Object { Receive-Job -Job $_ -ErrorAction Stop } | Sort-Object WorkerIndex)
  } finally {
    if ($jobs.Count -gt 0) {
      $jobs | Remove-Job -Force -ErrorAction SilentlyContinue
    }
  }
}

function Test-WorkerTransportSuccess {
  param([Parameter(Mandatory = $true)][object]$Worker)

  return $Worker.ExitCode -eq 0 -and -not $Worker.TimedOut -and [string]::IsNullOrWhiteSpace([string]$Worker.Stderr)
}

function Get-WorkerAggregate {
  param([Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$Workers)

  [pscustomobject]@{
    WorkerCount = $Workers.Count
    TimedOutCount = @($Workers | Where-Object { $_.TimedOut }).Count
    NonZeroExitCount = @($Workers | Where-Object { $_.ExitCode -ne 0 }).Count
  }
}

function Get-InsertWorkerEvidence {
  param([Parameter(Mandatory = $true)][object]$Worker)

  $lines = @(
    ([string]$Worker.Stdout -split '\r?\n') |
      ForEach-Object { $_.Trim() } |
      Where-Object { $_ }
  )
  $uuidLines = @($lines | Where-Object { $_ -match '(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' })
  $insertOneLines = @($lines | Where-Object { $_ -eq 'INSERT 0 1' })
  $insertZeroLines = @($lines | Where-Object { $_ -eq 'INSERT 0 0' })
  $unexpectedLines = @($lines | Where-Object { $_ -ne 'SET' -and $_ -notmatch '(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' -and $_ -ne 'INSERT 0 1' -and $_ -ne 'INSERT 0 0' })
  $transportSuccess = Test-WorkerTransportSuccess -Worker $Worker
  $isWinner = $transportSuccess -and $uuidLines.Count -eq 1 -and $insertOneLines.Count -eq 1 -and $insertZeroLines.Count -eq 0 -and $unexpectedLines.Count -eq 0
  $isNoOp = $transportSuccess -and $uuidLines.Count -eq 0 -and $insertOneLines.Count -eq 0 -and $insertZeroLines.Count -eq 1 -and $unexpectedLines.Count -eq 0
  $classification = if ($Worker.TimedOut) {
    'TIMEOUT'
  } elseif ($isWinner) {
    'WINNER'
  } elseif ($isNoOp) {
    'NO_OP'
  } else {
    'INVALID'
  }
  $sanitizedErrorCode = if ($Worker.TimedOut) {
    'WORKER_TIMEOUT'
  } elseif ($Worker.ExitCode -ne 0) {
    'NONZERO_EXIT'
  } elseif (-not [string]::IsNullOrWhiteSpace([string]$Worker.Stderr)) {
    'STDERR'
  } elseif ($unexpectedLines.Count -gt 0) {
    'UNEXPECTED_STDOUT'
  } else {
    ''
  }

  [pscustomobject]@{
    WorkerIndex = $Worker.WorkerIndex
    Classification = $classification
    ExitCode = $Worker.ExitCode
    TimedOut = [bool]$Worker.TimedOut
    UuidLineCount = $uuidLines.Count
    InsertOneTagCount = $insertOneLines.Count
    InsertZeroTagCount = $insertZeroLines.Count
    HasUnexpectedStdErr = -not [string]::IsNullOrWhiteSpace([string]$Worker.Stderr)
    SanitizedErrorCode = $sanitizedErrorCode
  }
}

$structuredEvidence = [ordered]@{
  SchemaVersion = 1
  OverallStatus = 'RUNNING'
  HasTimeout = $false
  TimeoutScenarioIds = @()
  Scenarios = @()
}

function Write-StructuredEvidence {
  $json = $structuredEvidence | ConvertTo-Json -Depth 8
  if ($json -match '(?i)postgres(?:ql)?://|bearer\s+[A-Za-z0-9._-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|password\s*[:=]|service[_-]?role[_-]?key\s*[:=]|anon[_-]?key\s*[:=]') {
    throw 'Structured concurrency evidence contains a forbidden secret pattern.'
  }
  [System.IO.File]::WriteAllText($StructuredEvidencePath, $json, $utf8NoBom)
}

function Add-ScenarioEvidence {
  param(
    [Parameter(Mandatory = $true)][string]$Id,
    [Parameter(Mandatory = $true)][bool]$Condition,
    [Parameter(Mandatory = $true)][string]$Detail,
    [Parameter(Mandatory = $true)][object]$Record
  )

  $timedOutCountProperty = $Record.PSObject.Properties['TimedOutCount']
  $timedOutCount = if ($null -ne $timedOutCountProperty) { [int]$timedOutCountProperty.Value } else { 0 }
  if ($timedOutCount -gt 0) {
    $Record.Status = 'TIMEOUT'
    $structuredEvidence.HasTimeout = $true
    $structuredEvidence.OverallStatus = 'TIMEOUT'
    $structuredEvidence.TimeoutScenarioIds += $Id
  } else {
    $Record.Status = if ($Condition) { 'PASS' } else { 'FAIL' }
  }
  $structuredEvidence.Scenarios += $Record
  Write-StructuredEvidence
  "$Id=$($Record.Status) $Detail" | Tee-Object -FilePath $EvidencePath -Append | Out-Null
  return $Record.Status
}

function Add-NotRunScenarioEvidence {
  param(
    [Parameter(Mandatory = $true)][string]$Id,
    [Parameter(Mandatory = $true)][string]$Reason
  )

  if (@($structuredEvidence.Scenarios | Where-Object { $_.ScenarioId -eq $Id }).Count -gt 0) { return }
  $structuredEvidence.Scenarios += [pscustomobject]@{
    ScenarioId = $Id
    Status = 'NOT_RUN'
    WorkerCount = 0
    TimedOutCount = 0
    NonZeroExitCount = 0
    Metrics = @{}
    Detail = $Reason
  }
  Write-StructuredEvidence
  "$Id=NOT_RUN $Reason" | Tee-Object -FilePath $EvidencePath -Append | Out-Null
}

function Stop-AfterTimeout {
  param([Parameter(Mandatory = $true)][string[]]$RemainingScenarioIds)

  foreach ($scenarioId in $RemainingScenarioIds) {
    Add-NotRunScenarioEvidence -Id $scenarioId -Reason 'not run after a prior concurrency worker timeout'
  }
  $structuredEvidence.OverallStatus = 'TIMEOUT'
  Write-StructuredEvidence
  'CONCURRENCY_TIMEOUT=TRUE'
  exit 124
}

function New-BasicScenarioEvidence {
  param(
    [Parameter(Mandatory = $true)][string]$Id,
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$Workers,
    [hashtable]$Metrics = @{}
  )

  $aggregate = Get-WorkerAggregate -Workers $Workers
  $record = [ordered]@{
    ScenarioId = $Id
    Status = 'NOT_RUN'
    WorkerCount = $aggregate.WorkerCount
    TimedOutCount = $aggregate.TimedOutCount
    NonZeroExitCount = $aggregate.NonZeroExitCount
    Metrics = $Metrics
  }
  [pscustomobject]$record
}

function New-InsertScenarioEvidence {
  param(
    [Parameter(Mandatory = $true)][string]$Id,
    [Parameter(Mandatory = $true)][object[]]$Workers,
    [Parameter(Mandatory = $true)][int]$StartLinkedRowCount,
    [Parameter(Mandatory = $true)][int]$FinalLinkedRowCount
  )

  $winnerCount = @($Workers | Where-Object { $_.Classification -eq 'WINNER' }).Count
  $noOpCount = @($Workers | Where-Object { $_.Classification -eq 'NO_OP' }).Count
  $invalidCount = @($Workers | Where-Object { $_.Classification -eq 'INVALID' }).Count
  $timedOutCount = @($Workers | Where-Object { $_.Classification -eq 'TIMEOUT' }).Count
  $nonZeroExitCount = @($Workers | Where-Object { $_.ExitCode -ne 0 }).Count
  [pscustomobject]@{
    ScenarioId = $Id
    Status = 'NOT_RUN'
    WorkerCount = $Workers.Count
    WinnerCount = $winnerCount
    NoOpCount = $noOpCount
    InvalidCount = $invalidCount
    TimedOutCount = $timedOutCount
    NonZeroExitCount = $nonZeroExitCount
    StartLinkedRowCount = $StartLinkedRowCount
    FinalLinkedRowCount = $FinalLinkedRowCount
    ExpectedWinnerCount = 1
    ExpectedNoOpCount = 7
    ExpectedInvalidCount = 0
    Workers = @($Workers)
  }
}

function New-GrantPair {
  param(
    [string]$ResultJti,
    [string]$TrackJti,
    [string]$Principal,
    [string]$Resource,
    [string]$ResultFingerprint,
    [int]$TrackMaxUses = 24
  )

  $payload = "jsonb_build_array(jsonb_build_object('jti_hash','$ResultJti','version',2,'purpose','anonymous-analysis-write','resource_type','analysis-run','resource_id','$Resource','operation','result:create','principal_hash','$Principal','expected_fingerprint_hash','$ResultFingerprint','max_uses',1,'issued_at',now(),'expires_at',now()+interval '1 hour'),jsonb_build_object('jti_hash','$TrackJti','version',2,'purpose','anonymous-analysis-write','resource_type','analysis-run','resource_id','$Resource','operation','track:create','principal_hash','$Principal','expected_fingerprint_hash',null,'max_uses',$TrackMaxUses,'issued_at',now(),'expires_at',now()+interval '1 hour'))"
  Invoke-ContainerSql "set role service_role; select public.create_anonymous_write_grants($payload)::text;" | Out-Null
}

Remove-Item -LiteralPath $EvidencePath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $StructuredEvidencePath -Force -ErrorAction SilentlyContinue
Write-StructuredEvidence

if ($RunTimeoutRegression) {
  $timeoutOutputs = Invoke-ConcurrentSql -Scenario 'TIMEOUT_REGRESSION' -SqlStatements @('__timeout_regression__') -WorkerTimeoutSeconds $TestWorkerTimeoutSeconds -UseSleepTestProcess
  $timeoutWorkers = @($timeoutOutputs | ForEach-Object { Get-InsertWorkerEvidence -Worker $_ })
  $timeoutRecord = New-InsertScenarioEvidence -Id 'C01' -Workers $timeoutWorkers -StartLinkedRowCount 0 -FinalLinkedRowCount 0
  $timeoutStatus = Add-ScenarioEvidence -Id 'C01' -Condition $false -Detail 'targeted worker timeout regression' -Record $timeoutRecord
  if ($timeoutStatus -ne 'TIMEOUT' -or -not $structuredEvidence.HasTimeout -or $timeoutRecord.TimedOutCount -ne 1 -or $timeoutWorkers[0].Classification -ne 'TIMEOUT' -or $timeoutWorkers[0].SanitizedErrorCode -ne 'WORKER_TIMEOUT') {
    throw 'Worker timeout regression did not preserve the TIMEOUT contract.'
  }
  Stop-AfterTimeout -RemainingScenarioIds @('C02', 'C03', 'C04', 'C05', 'T11', 'T12')
}

$dbContainer = Get-IsolatedDatabaseContainer
. (Join-Path $scriptRoot 'invoke-local-sql.ps1') -ProjectId $ProjectId -Sql 'select 1;' -TuplesOnly | Out-Null

$principal = ('a' * 64)
$resourceC01 = 'sec05-concurrency-result-run-000001'
$resultJtiC01 = ('b' * 64)
$trackJtiC01 = ('c' * 64)
$resultFingerprintC01 = ('d' * 64)
New-GrantPair -ResultJti $resultJtiC01 -TrackJti $trackJtiC01 -Principal $principal -Resource $resourceC01 -ResultFingerprint $resultFingerprintC01

$claimSql = "select pg_sleep(0.25); set role service_role; select public.claim_anonymous_write_grant('$resultJtiC01','$principal','analysis-run','$resourceC01','result:create','$resultFingerprintC01')::text;"
$claimOutputs = Invoke-ConcurrentSql -Scenario 'C01' -SqlStatements @($claimSql, $claimSql, $claimSql, $claimSql, $claimSql, $claimSql, $claimSql, $claimSql)
$claimed = @($claimOutputs | Where-Object { $_.Stdout -match '"state"\s*:\s*"claimed"' }).Count
$claimInvalid = @($claimOutputs | Where-Object { -not (Test-WorkerTransportSuccess -Worker $_) }).Count
$useCount = [int](Invoke-ContainerSql "select count(*) from public.anonymous_write_grant_uses where grant_id=(select id from public.anonymous_write_grants where jti_hash='$resultJtiC01');")
$c01Record = New-BasicScenarioEvidence -Id 'C01' -Workers $claimOutputs -Metrics @{ ClaimedCount = $claimed; UseCount = $useCount; InvalidCount = $claimInvalid }
$null = Add-ScenarioEvidence -Id 'C01' -Condition ($claimed -eq 1 -and $useCount -eq 1 -and $claimInvalid -eq 0) -Detail "claimed=$claimed uses=$useCount invalid=$claimInvalid" -Record $c01Record
if ($structuredEvidence.HasTimeout) { Stop-AfterTimeout -RemainingScenarioIds @('C02', 'C03', 'C04', 'C05', 'T11', 'T12') }

$completeOwnerSql = "select pg_sleep(0.25); set role service_role; select public.complete_anonymous_write_grant('$resultJtiC01','$principal','analysis-run','$resourceC01','result:create','$resultFingerprintC01',jsonb_build_object('kind','result'))::text;"
$completeStaleSql = "select pg_sleep(0.25); set role service_role; select public.complete_anonymous_write_grant('$resultJtiC01','$(('e' * 64))','analysis-run','$resourceC01','result:create','$resultFingerprintC01',jsonb_build_object('kind','result'))::text;"
$completeOutputs = Invoke-ConcurrentSql -Scenario 'C02' -SqlStatements @($completeOwnerSql, $completeStaleSql)
$ownerCompleted = @($completeOutputs | Where-Object { $_.Stdout -match '"updated"\s*:\s*true' }).Count
$staleDenied = @($completeOutputs | Where-Object { $_.Stdout -match '"updated"\s*:\s*false' }).Count
$completeInvalid = @($completeOutputs | Where-Object { -not (Test-WorkerTransportSuccess -Worker $_) }).Count
$c02Record = New-BasicScenarioEvidence -Id 'C02' -Workers $completeOutputs -Metrics @{ OwnerCompletedCount = $ownerCompleted; StaleDeniedCount = $staleDenied; InvalidCount = $completeInvalid }
$null = Add-ScenarioEvidence -Id 'C02' -Condition ($ownerCompleted -eq 1 -and $staleDenied -eq 1 -and $completeInvalid -eq 0) -Detail "ownerCompleted=$ownerCompleted staleDenied=$staleDenied invalid=$completeInvalid" -Record $c02Record
if ($structuredEvidence.HasTimeout) { Stop-AfterTimeout -RemainingScenarioIds @('C03', 'C04', 'C05', 'T11', 'T12') }

$useIdC01 = Invoke-ContainerSql "select id from public.anonymous_write_grant_uses where grant_id=(select id from public.anonymous_write_grants where jti_hash='$resultJtiC01');"
$insertSql = "select pg_sleep(0.25); with req as (insert into public.analysis_requests(session_id) values ('sec05-c03-' || gen_random_uuid()) returning id) insert into public.analysis_results(request_id, anonymous_write_grant_use_id) select id, '$useIdC01'::uuid from req on conflict (anonymous_write_grant_use_id) where anonymous_write_grant_use_id is not null do nothing returning id;"
$linkedResultCountBefore = [int](Invoke-ContainerSql "select count(*) from public.analysis_results where anonymous_write_grant_use_id='$useIdC01'::uuid;")
$insertOutputs = Invoke-ConcurrentSql -Scenario 'C03' -SqlStatements @($insertSql, $insertSql, $insertSql, $insertSql, $insertSql, $insertSql, $insertSql, $insertSql)
$insertEvidence = @($insertOutputs | ForEach-Object { Get-InsertWorkerEvidence -Worker $_ })
$linkedResultCount = [int](Invoke-ContainerSql "select count(*) from public.analysis_results where anonymous_write_grant_use_id='$useIdC01'::uuid;")
$c03Record = New-InsertScenarioEvidence -Id 'C03' -Workers $insertEvidence -StartLinkedRowCount $linkedResultCountBefore -FinalLinkedRowCount $linkedResultCount
$null = Add-ScenarioEvidence -Id 'C03' -Condition ($c03Record.WorkerCount -eq 8 -and $c03Record.WinnerCount -eq 1 -and $c03Record.NoOpCount -eq 7 -and $c03Record.InvalidCount -eq 0 -and $c03Record.TimedOutCount -eq 0 -and $c03Record.NonZeroExitCount -eq 0 -and $c03Record.StartLinkedRowCount -eq 0 -and $c03Record.FinalLinkedRowCount -eq 1) -Detail "before=$linkedResultCountBefore winners=$($c03Record.WinnerCount) noops=$($c03Record.NoOpCount) invalid=$($c03Record.InvalidCount) resultRows=$linkedResultCount" -Record $c03Record
if ($structuredEvidence.HasTimeout) { Stop-AfterTimeout -RemainingScenarioIds @('C04', 'C05', 'T11', 'T12') }

$resourceC04 = 'sec05-concurrency-track-run-000004'
$resultJtiC04 = ('f' * 64)
$trackJtiC04 = ('0' * 64)
$trackFingerprintC04 = ('1' * 64)
New-GrantPair -ResultJti $resultJtiC04 -TrackJti $trackJtiC04 -Principal $principal -Resource $resourceC04 -ResultFingerprint ('2' * 64)
$trackSql = "select pg_sleep(0.25); set role service_role; with claim as (select public.claim_anonymous_write_grant('$trackJtiC04','$principal','analysis-run','$resourceC04','track:create','$trackFingerprintC04') as payload) insert into public.recommendation_logs(event_name,session_id,anonymous_write_grant_use_id) select 'sec05-c04','$resourceC04',(payload->>'use_id')::uuid from claim where payload->>'state'='claimed' returning id;"
$trackLogCountBefore = [int](Invoke-ContainerSql "select count(*) from public.recommendation_logs where session_id='$resourceC04';")
$trackOutputs = Invoke-ConcurrentSql -Scenario 'C04' -SqlStatements @($trackSql, $trackSql, $trackSql, $trackSql, $trackSql, $trackSql, $trackSql, $trackSql)
$trackEvidence = @($trackOutputs | ForEach-Object { Get-InsertWorkerEvidence -Worker $_ })
$trackUseCount = [int](Invoke-ContainerSql "select count(*) from public.anonymous_write_grant_uses where grant_id=(select id from public.anonymous_write_grants where jti_hash='$trackJtiC04');")
$trackLogCount = [int](Invoke-ContainerSql "select count(*) from public.recommendation_logs where session_id='$resourceC04';")
$trackUsedCount = [int](Invoke-ContainerSql "select used_count from public.anonymous_write_grants where jti_hash='$trackJtiC04';")
$c04Record = New-InsertScenarioEvidence -Id 'C04' -Workers $trackEvidence -StartLinkedRowCount $trackLogCountBefore -FinalLinkedRowCount $trackLogCount
$c04Condition = $c04Record.WorkerCount -eq 8 -and $c04Record.WinnerCount -eq 1 -and $c04Record.NoOpCount -eq 7 -and $c04Record.InvalidCount -eq 0 -and $c04Record.TimedOutCount -eq 0 -and $c04Record.NonZeroExitCount -eq 0 -and $c04Record.StartLinkedRowCount -eq 0 -and $c04Record.FinalLinkedRowCount -eq 1 -and $trackUseCount -eq 1 -and $trackUsedCount -eq 1
$null = Add-ScenarioEvidence -Id 'C04' -Condition $c04Condition -Detail "before=$trackLogCountBefore winners=$($c04Record.WinnerCount) noops=$($c04Record.NoOpCount) invalid=$($c04Record.InvalidCount) uses=$trackUseCount logs=$trackLogCount used=$trackUsedCount" -Record $c04Record
if ($structuredEvidence.HasTimeout) { Stop-AfterTimeout -RemainingScenarioIds @('C05', 'T11', 'T12') }
$t11Record = New-BasicScenarioEvidence -Id 'T11' -Workers @() -Metrics @{ UseCount = $trackUseCount; LogCount = $trackLogCount; UsedCount = $trackUsedCount }
$null = Add-ScenarioEvidence -Id 'T11' -Condition ($trackUseCount -eq 1 -and $trackLogCount -eq 1 -and $trackUsedCount -eq 1) -Detail 'covered by C04 concurrent duplicate event' -Record $t11Record

$resourceC05 = 'sec05-concurrency-track-run-000005'
$resultJtiC05 = ('3' * 64)
$trackJtiC05 = ('4' * 64)
New-GrantPair -ResultJti $resultJtiC05 -TrackJti $trackJtiC05 -Principal $principal -Resource $resourceC05 -ResultFingerprint ('5' * 64)
1..23 | ForEach-Object {
  $fingerprint = ('a' * 62) + ('{0:x2}' -f $_)
  Invoke-ContainerSql "set role service_role; select public.claim_anonymous_write_grant('$trackJtiC05','$principal','analysis-run','$resourceC05','track:create','$fingerprint')::text;" | Out-Null
}
$boundarySql = 24..31 | ForEach-Object {
  $fingerprint = ('b' * 62) + ('{0:x2}' -f $_)
  "select pg_sleep(0.25); set role service_role; select public.claim_anonymous_write_grant('$trackJtiC05','$principal','analysis-run','$resourceC05','track:create','$fingerprint')::text;"
}
$boundaryOutputs = Invoke-ConcurrentSql -Scenario 'C05' -SqlStatements $boundarySql
$boundaryClaimed = @($boundaryOutputs | Where-Object { $_.Stdout -match '"state"\s*:\s*"claimed"' }).Count
$boundaryInvalid = @($boundaryOutputs | Where-Object { -not (Test-WorkerTransportSuccess -Worker $_) }).Count
$boundaryUsedCount = [int](Invoke-ContainerSql "select used_count from public.anonymous_write_grants where jti_hash='$trackJtiC05';")
$c05Record = New-BasicScenarioEvidence -Id 'C05' -Workers $boundaryOutputs -Metrics @{ ClaimedCount = $boundaryClaimed; UsedCount = $boundaryUsedCount; InvalidCount = $boundaryInvalid }
$null = Add-ScenarioEvidence -Id 'C05' -Condition ($boundaryClaimed -eq 1 -and $boundaryUsedCount -eq 24 -and $boundaryInvalid -eq 0) -Detail "claimed=$boundaryClaimed used=$boundaryUsedCount invalid=$boundaryInvalid" -Record $c05Record
if ($structuredEvidence.HasTimeout) { Stop-AfterTimeout -RemainingScenarioIds @('T12') }
$t12Record = New-BasicScenarioEvidence -Id 'T12' -Workers @() -Metrics @{ ClaimedCount = $boundaryClaimed; UsedCount = $boundaryUsedCount }
$null = Add-ScenarioEvidence -Id 'T12' -Condition ($boundaryClaimed -eq 1 -and $boundaryUsedCount -eq 24) -Detail 'covered by C05 max-use boundary race' -Record $t12Record

$scenarioStatuses = @($structuredEvidence.Scenarios | ForEach-Object { $_.Status })
$structuredEvidence.OverallStatus = if ($structuredEvidence.HasTimeout) { 'TIMEOUT' } elseif ($scenarioStatuses -contains 'FAIL') { 'FAIL' } else { 'PASS' }
Write-StructuredEvidence
if ($structuredEvidence.OverallStatus -eq 'TIMEOUT') { exit 124 }
if ($structuredEvidence.OverallStatus -eq 'FAIL') { exit 1 }
