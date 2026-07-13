[CmdletBinding()]
param(
  [ValidateRange(1, 2)][int]$Runs = 2,
  [switch]$RunTimeoutRegression
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$templateRoot = Join-Path $PSScriptRoot 'template'
$sourceMigrations = @(
  '20260424_align_analysis_results_share_schema.sql',
  '20260711032649_sec_05_anonymous_write_grants.sql'
)
$excludedServices = 'gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor'
$runFailures = @()
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$suiteDefinitions = @(
  [pscustomobject]@{ Id = 'STRUCTURE'; File = '001_sec05_structure.sql'; Scenarios = @('STRUCTURE') }
  [pscustomobject]@{ Id = 'PRIVILEGE_RLS'; File = '002_sec05_privileges_rls.sql'; Scenarios = @('PRIV_RLS') }
  [pscustomobject]@{ Id = 'RESULT_STATE_MACHINE'; File = '003_sec05_result_state_machine.sql'; Scenarios = @('R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11', 'R12', 'R13', 'R14', 'R15', 'R16', 'R17', 'R18', 'R19', 'R20', 'R21', 'R22', 'R23') }
  [pscustomobject]@{ Id = 'TRACK_STATE_MACHINE'; File = '004_sec05_track_state_machine.sql'; Scenarios = @('T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10', 'T13', 'T14', 'V05') }
)

function Assert-Path {
  param([string]$Path, [string]$Label)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "$Label is missing: $Path" }
}

function ConvertTo-ProcessArgument {
  param([AllowEmptyString()][string]$Argument)

  if ($Argument.Length -gt 0 -and $Argument -notmatch '[\s"]') {
    return $Argument
  }

  $escaped = [regex]::Replace($Argument, '(\\*)"', '$1$1\"')
  $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
  return '"' + $escaped + '"'
}

function Protect-SensitiveText {
  param(
    [AllowEmptyString()][string]$Text,
    [string]$TempWorkdir = ''
  )

  if ($null -eq $Text) { return '' }
  $sanitized = $Text
  if (-not [string]::IsNullOrWhiteSpace($TempWorkdir)) {
    $sanitized = $sanitized -replace [regex]::Escape($TempWorkdir), '<TEMP_WORKDIR>'
  }
  $sanitized = $sanitized -replace '(?i)postgres(?:ql)?://[^\s]+', '<REDACTED_CONNECTION_URI>'
  $sanitized = $sanitized -replace '(?i)https?://[^\s]+', '<REDACTED_URL>'
  $sanitized = $sanitized -replace '(?i)bearer\s+[A-Za-z0-9._-]+', 'Bearer <REDACTED>'
  $sanitized = $sanitized -replace '(?i)(?:anon|service[_-]?role|jwt|api)[_-]?key\s*[:=]\s*[^\s]+', '<REDACTED_KEY>'
  $sanitized = $sanitized -replace '(?i)password\s*[:=]\s*[^\s]+', 'password=<REDACTED>'
  $sanitized = $sanitized -replace 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', '<REDACTED_JWT>'
  return $sanitized
}

function Get-FirstCausalError {
  param(
    [AllowEmptyString()][string]$Stderr,
    [AllowEmptyString()][string]$Stdout = '',
    [string]$TempWorkdir = ''
  )

  $stderrLines = @(
    (Protect-SensitiveText -Text $Stderr -TempWorkdir $TempWorkdir) -split "`r?`n" |
      ForEach-Object { $_.Trim() } | Where-Object { $_ }
  )
  $stdoutLines = @(
    (Protect-SensitiveText -Text $Stdout -TempWorkdir $TempWorkdir) -split "`r?`n" |
      ForEach-Object { $_.Trim() } | Where-Object { $_ }
  )
  if ($stderrLines.Count -eq 0 -and $stdoutLines.Count -eq 0) { return 'no command output' }

  $informational = '(?i)new version of supabase|we recommend updating regularly|rerun.*--debug|using workdir|using profile|telemetry|\.supabase[\\/]profile.*cannot find'
  $normalTapPattern = '(?i)^\s*ok\s+\d+\b|^\s*1\.\.\d+\s*$'
  $specificCausalPattern = '(?i)^\s*(?:psql:|ERROR:|FATAL:|PANIC:|SQLSTATE\s*(?::|=|\[?[0-9A-Z]{5}\]?))|syntax error|violates (?:check|unique|foreign key) constraint'
  $causalPattern = '(?i)\bERROR\b|\bFATAL\b|\bPANIC\b|\bfailed\b|\bfailure\b|\binvalid\b|\bparse(?:d|r)?\b|toml.*(?:error|invalid|failed)|config.*(?:error|invalid|failed)'
  foreach ($lines in @($stderrLines, $stdoutLines)) {
    $specific = @($lines | Where-Object { $_ -notmatch $informational -and $_ -notmatch $normalTapPattern -and $_ -match $specificCausalPattern })
    if ($specific.Count -gt 0) { return $specific[0] }
  }
  foreach ($lines in @($stderrLines, $stdoutLines)) {
    $causal = @($lines | Where-Object { $_ -notmatch $informational -and $_ -notmatch $normalTapPattern -and $_ -match $causalPattern })
    if ($causal.Count -gt 0) { return $causal[0] }
  }

  foreach ($lines in @($stderrLines, $stdoutLines)) {
    $nonInformational = @($lines | Where-Object { $_ -notmatch $informational -and $_ -notmatch $normalTapPattern })
    if ($nonInformational.Count -gt 0) { return $nonInformational[-1] }
  }
  return 'no causal command output'
}

function Invoke-ExternalCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Executable,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$LogDirectory,
    [Parameter(Mandatory = $true)][string]$LogName,
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [string]$TempWorkdir = '',
    [ValidateRange(1, 3600)][int]$TimeoutSeconds = 1800
  )

  $resolvedCommands = @(Get-Command -Name $Executable -CommandType Application -ErrorAction Stop)
  $resolvedCommand = $resolvedCommands | Where-Object { $_.Path -match '(?i)\.exe$' } | Select-Object -First 1
  if ($null -eq $resolvedCommand) { $resolvedCommand = $resolvedCommands | Select-Object -First 1 }
  $resolved = $resolvedCommand.Path
  if ([string]::IsNullOrWhiteSpace($resolved)) { throw "Unable to resolve local executable: $Executable" }
  $stdoutPath = Join-Path $LogDirectory "$LogName.stdout.log"
  $stderrPath = Join-Path $LogDirectory "$LogName.stderr.log"
  $startedAt = [DateTimeOffset]::UtcNow
  $process = New-Object System.Diagnostics.Process
  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $resolved
  $startInfo.Arguments = (($Arguments | ForEach-Object { ConvertTo-ProcessArgument $_ }) -join ' ')
  $startInfo.WorkingDirectory = $WorkingDirectory
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $process.StartInfo = $startInfo

  if (-not $process.Start()) { throw "Unable to start local command: $Executable" }
  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()
  $timedOut = -not $process.WaitForExit($TimeoutSeconds * 1000)
  if ($timedOut) {
    try { $process.Kill() } catch {}
    $process.WaitForExit()
  }
  $stdout = $stdoutTask.GetAwaiter().GetResult()
  $stderr = $stderrTask.GetAwaiter().GetResult()
  [System.IO.File]::WriteAllText($stdoutPath, $stdout, $utf8NoBom)
  [System.IO.File]::WriteAllText($stderrPath, $stderr, $utf8NoBom)
  $finishedAt = [DateTimeOffset]::UtcNow
  $exitCode = if ($timedOut) { -1 } else { $process.ExitCode }
  $causalError = Get-FirstCausalError -Stderr $stderr -Stdout $stdout -TempWorkdir $TempWorkdir
  $sanitizedArguments = Protect-SensitiveText -Text ($Arguments -join ' ') -TempWorkdir $TempWorkdir

  [pscustomobject]@{
    CommandName = [System.IO.Path]::GetFileName($resolved)
    SanitizedArguments = $sanitizedArguments
    ExitCode = $exitCode
    StdoutPath = $stdoutPath
    StderrPath = $stderrPath
    StartedAt = $startedAt.ToString('o')
    FinishedAt = $finishedAt.ToString('o')
    DurationSeconds = [Math]::Round(($finishedAt - $startedAt).TotalSeconds, 3)
    TimedOut = $timedOut
    FirstCausalError = $causalError
    SanitizedSummary = "exit=$exitCode timedOut=$timedOut cause=$causalError"
  }
}

function Get-ProjectResidue {
  param(
    [string]$ProjectId,
    [string]$LogDirectory,
    [string]$RunLabel,
    [string]$TempWorkdir
  )

  $containersResult = Invoke-ExternalCommand -Executable 'docker' -Arguments @('ps', '-a', '--filter', "label=com.supabase.cli.project=$ProjectId", '--format', '{{.ID}}') -LogDirectory $LogDirectory -LogName "$RunLabel-containers" -WorkingDirectory $repoRoot -TempWorkdir $TempWorkdir -TimeoutSeconds 30
  $volumesResult = Invoke-ExternalCommand -Executable 'docker' -Arguments @('volume', 'ls', '--filter', "label=com.supabase.cli.project=$ProjectId", '--format', '{{.Name}}') -LogDirectory $LogDirectory -LogName "$RunLabel-volumes" -WorkingDirectory $repoRoot -TempWorkdir $TempWorkdir -TimeoutSeconds 30
  if ($containersResult.ExitCode -ne 0 -or $volumesResult.ExitCode -ne 0) {
    throw "[CLEANUP_FAILED] Unable to inspect isolated Docker residue."
  }
  $containers = @((Get-Content -Raw -LiteralPath $containersResult.StdoutPath) -split "`r?`n" | Where-Object { $_.Trim() })
  $volumes = @((Get-Content -Raw -LiteralPath $volumesResult.StdoutPath) -split "`r?`n" | Where-Object { $_.Trim() })
  [pscustomobject]@{ Containers = $containers; Volumes = $volumes }
}

function New-SuiteEvidenceRecord {
  param([string]$SuiteId)

  [pscustomobject]@{
    SuiteId = $SuiteId
    Started = $false
    Completed = $false
    ExitCode = $null
    PlannedAssertions = 0
    ObservedAssertions = 0
    PassedAssertions = 0
    FailedAssertions = 0
    ObservedAssertionNumbers = @()
    PassedAssertionNumbers = @()
    FailedAssertionNumbers = @()
    MissingAssertionNumbers = @()
    ScenarioIds = @()
    PassedScenarioIds = @()
    FailedScenarioIds = @()
    NotRunScenarioIds = @()
    ScenarioResults = @()
    Status = 'NOT_RUN'
    SanitizedFirstError = ''
    Detail = ''
    StructuredEvidence = $null
  }
}

function Write-SanitizedEvidence {
  param(
    [Parameter(Mandatory = $true)][object]$Evidence,
    [Parameter(Mandatory = $true)][string]$EvidencePath
  )

  $json = $Evidence | ConvertTo-Json -Depth 8
  if ($json -match '(?i)postgres(?:ql)?://|bearer\s+[A-Za-z0-9._-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|password\s*[:=]|service[_-]?role[_-]?key\s*[:=]|anon[_-]?key\s*[:=]') {
    throw '[EVIDENCE_SANITIZATION_FAILED] Sanitized evidence contains a forbidden pattern.'
  }
  [System.IO.File]::WriteAllText($EvidencePath, $json, $utf8NoBom)
}

function Get-PgtapSuiteEvidence {
  param(
    [Parameter(Mandatory = $true)][string]$SuiteId,
    [Parameter(Mandatory = $true)][string[]]$ExpectedScenarios,
    [Parameter(Mandatory = $true)][string]$SuitePath,
    [Parameter(Mandatory = $true)][object]$CommandResult,
    [string]$TempWorkdir = ''
  )

  $stdout = if (Test-Path -LiteralPath $CommandResult.StdoutPath) { [string](Get-Content -Raw -LiteralPath $CommandResult.StdoutPath) } else { '' }
  $stderr = if (Test-Path -LiteralPath $CommandResult.StderrPath) { [string](Get-Content -Raw -LiteralPath $CommandResult.StderrPath) } else { '' }
  $combined = $stdout + [Environment]::NewLine + $stderr
  $suiteSource = Get-Content -Raw -LiteralPath $SuitePath
  $planMatch = [regex]::Match($suiteSource, '(?im)^\s*select\s+plan\((?<count>\d+)\)\s*;')
  $tapMatches = [regex]::Matches($stdout, '(?im)^\s*(?<status>ok|not ok)\s+(?<number>\d+)(?:\s*-\s*.*)?$')
  $outputPlanMatch = [regex]::Match($stdout, '(?im)^\s*1\.\.(?<count>\d+)\s*$')
  $bailoutMatch = [regex]::Match($combined, '(?im)^\s*Bail out!.*$')
  $bailoutDetected = $bailoutMatch.Success
  $sqlOrParserErrorDetected = $combined -match '(?im)^\s*(?:ERROR:|FATAL:|PANIC:|psql:.*(?:ERROR|FATAL|PANIC)|error running container:)'
  $scenarioIds = @($ExpectedScenarios | Where-Object { $suiteSource -match ('(?<![A-Za-z0-9_])' + [regex]::Escape($_) + '(?![A-Za-z0-9_])') })
  $record = New-SuiteEvidenceRecord -SuiteId $SuiteId
  $record.Started = $true
  $record.Completed = -not $CommandResult.TimedOut
  $record.ExitCode = $CommandResult.ExitCode
  $record.PlannedAssertions = if ($planMatch.Success) { [int]$planMatch.Groups['count'].Value } else { 0 }
  $record.ScenarioIds = $scenarioIds

  $tapByNumber = @{}
  $duplicateAssertionNumbers = @()
  foreach ($tapMatch in $tapMatches) {
    $number = [int]$tapMatch.Groups['number'].Value
    if ($tapByNumber.ContainsKey($number)) {
      $duplicateAssertionNumbers += $number
      continue
    }
    $tapByNumber[$number] = $tapMatch.Groups['status'].Value
  }

  $expectedNumbers = if ($record.PlannedAssertions -gt 0) { @(1..$record.PlannedAssertions) } else { @() }
  $record.ObservedAssertionNumbers = @($tapByNumber.Keys | Sort-Object)
  $record.PassedAssertionNumbers = @($record.ObservedAssertionNumbers | Where-Object { $tapByNumber[$_] -eq 'ok' })
  $record.FailedAssertionNumbers = @($record.ObservedAssertionNumbers | Where-Object { $tapByNumber[$_] -eq 'not ok' })
  $record.MissingAssertionNumbers = @($expectedNumbers | Where-Object { -not $tapByNumber.ContainsKey($_) })
  $record.ObservedAssertions = $record.ObservedAssertionNumbers.Count
  $record.PassedAssertions = $record.PassedAssertionNumbers.Count
  $record.FailedAssertions = $record.FailedAssertionNumbers.Count

  $scenarioResults = @()
  for ($index = 0; $index -lt $ExpectedScenarios.Count; $index++) {
    $number = $index + 1
    $scenarioId = $ExpectedScenarios[$index]
    $scenarioStatus = if ($tapByNumber.ContainsKey($number)) {
      if ($tapByNumber[$number] -eq 'ok') { 'PASS' } else { 'FAIL' }
    } else {
      'NOT_RUN'
    }
    $scenarioResults += [pscustomobject]@{ Id = $scenarioId; AssertionNumber = $number; Status = $scenarioStatus }
  }
  $record.ScenarioResults = $scenarioResults
  $record.PassedScenarioIds = @($scenarioResults | Where-Object { $_.Status -eq 'PASS' } | ForEach-Object { $_.Id })
  $record.FailedScenarioIds = @($scenarioResults | Where-Object { $_.Status -eq 'FAIL' } | ForEach-Object { $_.Id })
  $record.NotRunScenarioIds = @($scenarioResults | Where-Object { $_.Status -eq 'NOT_RUN' } | ForEach-Object { $_.Id })
  $firstFailedTapMatch = @($tapMatches | Where-Object { $_.Groups['status'].Value -eq 'not ok' } | Sort-Object { [int]$_.Groups['number'].Value } | Select-Object -First 1)

  $outputPlanMatchesSource = $outputPlanMatch.Success -and ([int]$outputPlanMatch.Groups['count'].Value -eq $record.PlannedAssertions)
  $allExpectedAssertionsObserved = $record.MissingAssertionNumbers.Count -eq 0
  $noUnexpectedAssertions = @($record.ObservedAssertionNumbers | Where-Object { $_ -lt 1 -or $_ -gt $record.PlannedAssertions }).Count -eq 0
  $complete = -not $CommandResult.TimedOut -and $CommandResult.ExitCode -eq 0 -and $record.PlannedAssertions -gt 0 -and $outputPlanMatchesSource -and $allExpectedAssertionsObserved -and $noUnexpectedAssertions -and $duplicateAssertionNumbers.Count -eq 0 -and $record.FailedAssertions -eq 0 -and $scenarioIds.Count -eq $ExpectedScenarios.Count -and -not $bailoutDetected -and -not $sqlOrParserErrorDetected
  if ($CommandResult.TimedOut) {
    $record.Status = 'TIMEOUT'
    $record.SanitizedFirstError = Protect-SensitiveText -Text $CommandResult.FirstCausalError -TempWorkdir $TempWorkdir
    $record.Detail = 'pgTAP command timed out; later DB-dependent suites must not execute.'
  } elseif ($complete) {
    $record.Status = 'PASS'
    $record.Detail = 'Supabase CLI exit 0; actual TAP plan, assertion numbers, and required scenarios match the executed suite contract.'
  } else {
    $record.Status = 'FAIL'
    if ($firstFailedTapMatch.Count -gt 0) {
      $record.SanitizedFirstError = Protect-SensitiveText -Text $firstFailedTapMatch[0].Value.Trim() -TempWorkdir $TempWorkdir
    } elseif ($bailoutMatch.Success) {
      $record.SanitizedFirstError = Protect-SensitiveText -Text $bailoutMatch.Value.Trim() -TempWorkdir $TempWorkdir
    } else {
      $record.SanitizedFirstError = Protect-SensitiveText -Text $CommandResult.FirstCausalError -TempWorkdir $TempWorkdir
    }
    $record.Detail = "pgTAP exit, actual TAP plan/assertion output, SQL/parser output, or required scenario contract was incomplete. observed=$($record.ObservedAssertionNumbers -join ',') missing=$($record.MissingAssertionNumbers -join ',') duplicate=$($duplicateAssertionNumbers -join ',')"
  }
  return $record
}

function Get-ConcurrencySuiteEvidence {
  param(
    [Parameter(Mandatory = $true)][object]$CommandResult,
    [Parameter(Mandatory = $true)][string]$ConcurrencyLogPath,
    [Parameter(Mandatory = $true)][string]$StructuredEvidencePath,
    [string]$TempWorkdir = ''
  )

  $expectedScenarios = @('C01', 'C02', 'C03', 'C04', 'C05', 'T11', 'T12')
  $log = if (Test-Path -LiteralPath $ConcurrencyLogPath) { Get-Content -Raw -LiteralPath $ConcurrencyLogPath } else { '' }
  $record = New-SuiteEvidenceRecord -SuiteId 'CONCURRENCY'
  $record.Started = $true
  $record.Completed = -not $CommandResult.TimedOut
  $record.ExitCode = $CommandResult.ExitCode
  $record.PlannedAssertions = $expectedScenarios.Count
  if (Test-Path -LiteralPath $StructuredEvidencePath) {
    $record.StructuredEvidence = Get-Content -LiteralPath $StructuredEvidencePath -Raw | ConvertFrom-Json
  }

  $structuredScenarios = if ($null -ne $record.StructuredEvidence -and $null -ne $record.StructuredEvidence.PSObject.Properties['Scenarios']) { @($record.StructuredEvidence.Scenarios) } else { @() }
  $scenarioResults = @()
  foreach ($index in 0..($expectedScenarios.Count - 1)) {
    $scenarioId = $expectedScenarios[$index]
    $scenario = @($structuredScenarios | Where-Object { $_.ScenarioId -eq $scenarioId })
    $status = if ($scenario.Count -eq 1 -and $scenario[0].Status -in @('PASS', 'FAIL', 'TIMEOUT', 'NOT_RUN')) { [string]$scenario[0].Status } else { 'NOT_RUN' }
    $scenarioResults += [pscustomobject]@{ Id = $scenarioId; AssertionNumber = $index + 1; Status = $status }
  }
  $record.ScenarioResults = $scenarioResults
  $record.ScenarioIds = @($scenarioResults | ForEach-Object { $_.Id })
  $record.PassedScenarioIds = @($scenarioResults | Where-Object { $_.Status -eq 'PASS' } | ForEach-Object { $_.Id })
  $record.FailedScenarioIds = @($scenarioResults | Where-Object { $_.Status -in @('FAIL', 'TIMEOUT') } | ForEach-Object { $_.Id })
  $record.NotRunScenarioIds = @($scenarioResults | Where-Object { $_.Status -eq 'NOT_RUN' } | ForEach-Object { $_.Id })
  $record.ObservedAssertionNumbers = @($scenarioResults | Where-Object { $_.Status -ne 'NOT_RUN' } | ForEach-Object { $_.AssertionNumber })
  $record.PassedAssertionNumbers = @($scenarioResults | Where-Object { $_.Status -eq 'PASS' } | ForEach-Object { $_.AssertionNumber })
  $record.FailedAssertionNumbers = @($scenarioResults | Where-Object { $_.Status -in @('FAIL', 'TIMEOUT') } | ForEach-Object { $_.AssertionNumber })
  $record.MissingAssertionNumbers = @($scenarioResults | Where-Object { $_.Status -eq 'NOT_RUN' } | ForEach-Object { $_.AssertionNumber })
  $record.ObservedAssertions = $record.ObservedAssertionNumbers.Count
  $record.PassedAssertions = $record.PassedAssertionNumbers.Count
  $record.FailedAssertions = $record.FailedAssertionNumbers.Count

  $structuredHasTimeout = $false
  $timeoutScenarioIds = @()
  if ($null -ne $record.StructuredEvidence) {
    $hasTimeoutProperty = $record.StructuredEvidence.PSObject.Properties['HasTimeout']
    $overallStatusProperty = $record.StructuredEvidence.PSObject.Properties['OverallStatus']
    $timeoutScenarioIds = @($structuredScenarios | Where-Object { $_.Status -eq 'TIMEOUT' } | ForEach-Object { $_.ScenarioId })
    $workerTimeoutPresent = @($structuredScenarios | Where-Object { @($_.Workers | Where-Object { $_.Classification -eq 'TIMEOUT' -or $_.TimedOut -eq $true }).Count -gt 0 }).Count -gt 0
    $structuredHasTimeout = ($null -ne $hasTimeoutProperty -and [bool]$hasTimeoutProperty.Value) -or ($null -ne $overallStatusProperty -and $overallStatusProperty.Value -eq 'TIMEOUT') -or $timeoutScenarioIds.Count -gt 0 -or $workerTimeoutPresent
  }

  if ($CommandResult.TimedOut -or $structuredHasTimeout) {
    $record.Completed = -not $CommandResult.TimedOut
    $record.Status = 'TIMEOUT'
    $record.SanitizedFirstError = if ($timeoutScenarioIds.Count -gt 0) { "worker timeout: $($timeoutScenarioIds -join ',')" } else { Protect-SensitiveText -Text $CommandResult.FirstCausalError -TempWorkdir $TempWorkdir }
    $record.Detail = 'Concurrency command or structured worker evidence timed out; later DB-dependent suites must not execute.'
  } elseif ($CommandResult.ExitCode -eq 0 -and $record.PassedAssertions -eq $expectedScenarios.Count -and $log -notmatch '(?m)=(?:FAIL|NOT_RUN|TIMEOUT)\b' -and $null -ne $record.StructuredEvidence -and $record.StructuredEvidence.OverallStatus -eq 'PASS') {
    $record.Status = 'PASS'
    $record.Detail = 'All required multi-connection scenarios reported PASS.'
  } else {
    $record.Status = 'FAIL'
    $record.SanitizedFirstError = Protect-SensitiveText -Text $CommandResult.FirstCausalError -TempWorkdir $TempWorkdir
    $record.Detail = 'Concurrency process or required scenario evidence failed.'
  }
  return $record
}

function Invoke-IsolatedRun {
  param([int]$RunNumber)

  $runNonce = [Guid]::NewGuid().ToString('N').Substring(0, 12)
  $projectId = "sec05iso$runNonce"
  $workDir = Join-Path $env:TEMP "kbeauty-sec05-isolated-$runNonce"
  $supabaseDir = Join-Path $workDir 'supabase'
  $migrationsDir = Join-Path $supabaseDir 'migrations'
  $testsDir = Join-Path $supabaseDir 'tests'
  $logsDir = Join-Path $workDir 'logs'
  $evidencePath = Join-Path $env:TEMP "kbeauty-sec05-isolated-evidence-$runNonce.json"
  $started = $false
  $startAttempted = $false
  $primaryFailure = $null
  $executionTimedOut = $false
  $postMigrationFailures = New-Object System.Collections.Generic.List[string]
  $cleanupFailures = New-Object System.Collections.Generic.List[string]
  $concurrencyLog = Join-Path $logsDir 'concurrency.log'
  $structuredConcurrencyPath = Join-Path $logsDir 'concurrency-sanitized.json'
  $oracleLogsDir = Join-Path $env:TEMP "kbeauty-sec05-isolated-oracle-$runNonce"
  $runEvidence = [pscustomobject]@{
    SchemaVersion = 1
    RunNumber = $RunNumber
    GeneratedAt = [DateTimeOffset]::UtcNow.ToString('o')
    OverallStatus = 'RUNNING'
    CleanupStatus = 'PENDING'
    Cleanup = [pscustomobject]@{
      TempWorkdirResidueCount = $null
      ContainerResidueCount = $null
      VolumeResidueCount = $null
      RawArtifactResidueCount = $null
      IntermediateConcurrencyEvidenceResidueCount = $null
    }
    PostMigrationFailures = @()
    Suites = [ordered]@{
      STRUCTURE = New-SuiteEvidenceRecord -SuiteId 'STRUCTURE'
      PRIVILEGE_RLS = New-SuiteEvidenceRecord -SuiteId 'PRIVILEGE_RLS'
      RESULT_STATE_MACHINE = New-SuiteEvidenceRecord -SuiteId 'RESULT_STATE_MACHINE'
      TRACK_STATE_MACHINE = New-SuiteEvidenceRecord -SuiteId 'TRACK_STATE_MACHINE'
      CONCURRENCY = New-SuiteEvidenceRecord -SuiteId 'CONCURRENCY'
      V05 = New-SuiteEvidenceRecord -SuiteId 'V05'
      TEST_ORACLE = New-SuiteEvidenceRecord -SuiteId 'TEST_ORACLE'
    }
  }

  try {
    Write-SanitizedEvidence -Evidence $runEvidence -EvidencePath $evidencePath
    "RUN_${RunNumber}_EVIDENCE=$evidencePath"
    New-Item -ItemType Directory -Force -Path $migrationsDir, $testsDir, $logsDir | Out-Null
    $configTemplate = Get-Content -Raw -Encoding UTF8 (Join-Path $templateRoot 'config.toml')
    if ($configTemplate -notmatch '__SEC05_ISOLATED_PROJECT_ID__') { throw 'Isolated config placeholder is missing.' }
    $renderedConfig = $configTemplate.Replace('__SEC05_ISOLATED_PROJECT_ID__', $projectId)
    $configPath = Join-Path $supabaseDir 'config.toml'
    [System.IO.File]::WriteAllText($configPath, $renderedConfig, $utf8NoBom)
    $configBytes = [System.IO.File]::ReadAllBytes($configPath)
    $utf8BomPresent = $configBytes.Length -ge 3 -and $configBytes[0] -eq 0xEF -and $configBytes[1] -eq 0xBB -and $configBytes[2] -eq 0xBF
    $isolatedProjectIdPresent = ([System.IO.File]::ReadAllText($configPath, $utf8NoBom) -match ('(?m)^project_id\s*=\s*"' + [regex]::Escape($projectId) + '"$'))
    $forbiddenConfigPattern = '(?i)project[_-]?ref|access[_-]?token|service[_-]?role[_-]?key|password\s*='
    "RUN_${RunNumber}_CONFIG configExists=$(Test-Path -LiteralPath $configPath) configLength=$($configBytes.Length) utf8BomPresent=$utf8BomPresent isolatedProjectIdPresent=$isolatedProjectIdPresent"
    if ($configBytes.Length -eq 0 -or $utf8BomPresent -or -not $isolatedProjectIdPresent -or $renderedConfig -match $forbiddenConfigPattern) {
      throw '[CONFIG_UTF8_BOM_DETECTED] Rendered isolated config failed byte or content validation.'
    }

    $bootstrapPath = Join-Path $templateRoot 'bootstrap\00000000000000_pre_sec05_minimal_schema.sql'
    Assert-Path -Path $bootstrapPath -Label 'Bootstrap migration'
    $bootstrapText = Get-Content -Raw -Encoding UTF8 $bootstrapPath
    foreach ($forbidden in @('anonymous_write_grants', 'anonymous_write_grant_uses', 'anonymous_write_grant_use_id')) {
      if ($bootstrapText -match $forbidden) { throw "Bootstrap pre-creates SEC-05 object: $forbidden" }
    }
    Copy-Item -LiteralPath $bootstrapPath -Destination (Join-Path $migrationsDir '00000000000000_pre_sec05_minimal_schema.sql')

    foreach ($migrationName in $sourceMigrations) {
      $sourcePath = Join-Path $repoRoot "supabase\migrations\$migrationName"
      $stagedPath = Join-Path $migrationsDir $migrationName
      Assert-Path -Path $sourcePath -Label 'Production migration source'
      Copy-Item -LiteralPath $sourcePath -Destination $stagedPath
      $sourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash
      $stagedHash = (Get-FileHash -LiteralPath $stagedPath -Algorithm SHA256).Hash
      if ($sourceHash -ne $stagedHash) { throw "Staged production migration hash mismatch: $migrationName" }
    }

    Get-ChildItem -LiteralPath (Join-Path $templateRoot 'tests') -Filter '*.sql' | ForEach-Object {
      Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $testsDir $_.Name)
    }
    Copy-Item -LiteralPath (Join-Path $templateRoot 'scripts\invoke-local-sql.ps1') -Destination (Join-Path $workDir 'invoke-local-sql.ps1')
    Copy-Item -LiteralPath (Join-Path $templateRoot 'scripts\run-concurrency-tests.ps1') -Destination (Join-Path $workDir 'run-concurrency-tests.ps1')
    Copy-Item -LiteralPath (Join-Path $templateRoot 'scripts\verify-test-evidence.ps1') -Destination (Join-Path $workDir 'verify-test-evidence.ps1')

    $commandInventory = @(
      'supabase start --workdir <TEMP_WORKDIR> --exclude <non-db-services> --yes',
      'supabase db reset --workdir <TEMP_WORKDIR> --local --no-seed --yes',
      'supabase test db <TEMP_TEST_FILES> --workdir <TEMP_WORKDIR> --local',
      'powershell run-concurrency-tests.ps1 <isolated project only>',
      'supabase stop --project-id <isolated project only> --no-backup'
    ) -join [Environment]::NewLine
    [System.IO.File]::WriteAllText((Join-Path $logsDir 'commands.log'), $commandInventory, $utf8NoBom)

    $startAttempted = $true
    $startResult = Invoke-ExternalCommand -Executable 'supabase' -Arguments @('--agent', 'no', 'start', '--workdir', $workDir, '--exclude', $excludedServices, '--yes') -LogDirectory $logsDir -LogName "run-$RunNumber-start" -WorkingDirectory $repoRoot -TempWorkdir $workDir -TimeoutSeconds 1800
    if ($startResult.TimedOut) { throw "[EXECUTION_TIMEOUT] supabase start: $($startResult.SanitizedSummary)" }
    if ($startResult.ExitCode -ne 0) { throw "[SUPABASE_START_FAILED] $($startResult.SanitizedSummary)" }
    $started = $true
    "RUN_${RunNumber}_SUPABASE_START exit=$($startResult.ExitCode) durationSeconds=$($startResult.DurationSeconds)"

    $resetResult = Invoke-ExternalCommand -Executable 'supabase' -Arguments @('--agent', 'no', 'db', 'reset', '--workdir', $workDir, '--local', '--no-seed', '--yes') -LogDirectory $logsDir -LogName "run-$RunNumber-migration" -WorkingDirectory $repoRoot -TempWorkdir $workDir -TimeoutSeconds 900
    if ($resetResult.TimedOut) { throw "[EXECUTION_TIMEOUT] migration reset: $($resetResult.SanitizedSummary)" }
    if ($resetResult.ExitCode -ne 0) { throw "[MIGRATION_APPLY_FAILED] $($resetResult.SanitizedSummary)" }
    "RUN_${RunNumber}_MIGRATION_APPLY=PASS"

    foreach ($suiteDefinition in $suiteDefinitions) {
      $pendingRecord = $runEvidence.Suites[$suiteDefinition.Id]
      $pendingRecord.Started = $true
      $runEvidence.Suites[$suiteDefinition.Id] = $pendingRecord
      Write-SanitizedEvidence -Evidence $runEvidence -EvidencePath $evidencePath

      $suitePath = Join-Path $testsDir $suiteDefinition.File
      $suiteResult = Invoke-ExternalCommand -Executable 'supabase' -Arguments @('--agent', 'no', '--debug', 'test', 'db', $suitePath, '--workdir', $workDir, '--local') -LogDirectory $logsDir -LogName "run-$RunNumber-$($suiteDefinition.Id.ToLower())" -WorkingDirectory $repoRoot -TempWorkdir $workDir -TimeoutSeconds 900
      $suiteRecord = Get-PgtapSuiteEvidence -SuiteId $suiteDefinition.Id -ExpectedScenarios $suiteDefinition.Scenarios -SuitePath $suitePath -CommandResult $suiteResult -TempWorkdir $workDir
      $runEvidence.Suites[$suiteDefinition.Id] = $suiteRecord

      if ($suiteDefinition.Id -eq 'TRACK_STATE_MACHINE') {
        $v05Record = $runEvidence.Suites.V05
        $v05Scenario = @($suiteRecord.ScenarioResults | Where-Object { $_.Id -eq 'V05' }) | Select-Object -First 1
        $v05Record.Started = $true
        $v05Record.Completed = $true
        $v05Record.ExitCode = $suiteRecord.ExitCode
        $v05Record.PlannedAssertions = 1
        $v05Record.ScenarioIds = @('V05')
        if ($null -ne $v05Scenario -and $v05Scenario.Status -eq 'PASS') {
          $v05Record.ObservedAssertions = 1
          $v05Record.PassedAssertions = 1
          $v05Record.ObservedAssertionNumbers = @(1)
          $v05Record.PassedAssertionNumbers = @(1)
          $v05Record.PassedScenarioIds = @('V05')
          $v05Record.ScenarioResults = @([pscustomobject]@{ Id = 'V05'; AssertionNumber = 1; Status = 'PASS' })
          $v05Record.Status = 'PASS'
          $v05Record.Detail = 'KNOWN_LOW_RESIDUAL_RISK_REPRODUCED'
        } elseif ($null -ne $v05Scenario -and $v05Scenario.Status -eq 'FAIL') {
          $v05Record.ObservedAssertions = 1
          $v05Record.FailedAssertions = 1
          $v05Record.ObservedAssertionNumbers = @(1)
          $v05Record.FailedAssertionNumbers = @(1)
          $v05Record.FailedScenarioIds = @('V05')
          $v05Record.ScenarioResults = @([pscustomobject]@{ Id = 'V05'; AssertionNumber = 1; Status = 'FAIL' })
          $v05Record.Status = 'FAIL'
          $v05Record.SanitizedFirstError = $suiteRecord.SanitizedFirstError
          $v05Record.Detail = 'V05 assertion failed during cleanup characterization.'
        } else {
          $v05Record.MissingAssertionNumbers = @(1)
          $v05Record.NotRunScenarioIds = @('V05')
          $v05Record.ScenarioResults = @([pscustomobject]@{ Id = 'V05'; AssertionNumber = 1; Status = 'NOT_RUN' })
          $v05Record.Detail = 'Track suite did not produce V05 TAP evidence.'
        }
        $runEvidence.Suites.V05 = $v05Record
      }

      Write-SanitizedEvidence -Evidence $runEvidence -EvidencePath $evidencePath
      "RUN_${RunNumber}_$($suiteDefinition.Id)=$($suiteRecord.Status)"
      if ($suiteRecord.Status -ne 'PASS') {
        $postMigrationFailures.Add("[PGTAP_$($suiteDefinition.Id)_FAILED] $($suiteRecord.SanitizedFirstError)")
      }
      if ($suiteRecord.Status -eq 'TIMEOUT') {
        $executionTimedOut = $true
        $postMigrationFailures.Add("[EXECUTION_TIMEOUT] $($suiteDefinition.Id)")
        break
      }
    }

    if (-not $executionTimedOut) {
      $pendingConcurrency = $runEvidence.Suites.CONCURRENCY
      $pendingConcurrency.Started = $true
      $runEvidence.Suites.CONCURRENCY = $pendingConcurrency
      Write-SanitizedEvidence -Evidence $runEvidence -EvidencePath $evidencePath
      $concurrencyResult = Invoke-ExternalCommand -Executable 'powershell' -Arguments @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $workDir 'run-concurrency-tests.ps1'), '-ProjectId', $projectId, '-EvidencePath', $concurrencyLog, '-StructuredEvidencePath', $structuredConcurrencyPath) -LogDirectory $logsDir -LogName "run-$RunNumber-concurrency" -WorkingDirectory $repoRoot -TempWorkdir $workDir -TimeoutSeconds 900
      $concurrencyRecord = Get-ConcurrencySuiteEvidence -CommandResult $concurrencyResult -ConcurrencyLogPath $concurrencyLog -StructuredEvidencePath $structuredConcurrencyPath -TempWorkdir $workDir
      $runEvidence.Suites.CONCURRENCY = $concurrencyRecord
      Write-SanitizedEvidence -Evidence $runEvidence -EvidencePath $evidencePath
      "RUN_$($RunNumber)_CONCURRENCY=$($concurrencyRecord.Status)"
      if ($concurrencyRecord.Status -ne 'PASS') { $postMigrationFailures.Add("[CONCURRENCY_TEST_FAILED] $($concurrencyRecord.SanitizedFirstError)") }
      if ($concurrencyRecord.Status -eq 'TIMEOUT') {
        $executionTimedOut = $true
        $postMigrationFailures.Add('[EXECUTION_TIMEOUT] CONCURRENCY')
      }
    }
  } catch {
    $primaryFailure = $_.Exception.Message
  } finally {
    if ($startAttempted -and (Test-Path -LiteralPath $logsDir)) {
      try {
        $stopResult = Invoke-ExternalCommand -Executable 'supabase' -Arguments @('--agent', 'no', 'stop', '--project-id', $projectId, '--no-backup') -LogDirectory $logsDir -LogName "run-$RunNumber-stop" -WorkingDirectory $repoRoot -TempWorkdir $workDir -TimeoutSeconds 120
        if ($stopResult.TimedOut -or $stopResult.ExitCode -ne 0) {
          $cleanupFailures.Add("isolated stop: $($stopResult.SanitizedSummary)")
        }
      } catch {
        $cleanupFailures.Add("isolated stop invocation: $($_.Exception.Message)")
      }
    }
    if (Test-Path -LiteralPath $logsDir) {
      try {
        $residue = Get-ProjectResidue -ProjectId $projectId -LogDirectory $logsDir -RunLabel "run-$RunNumber-cleanup" -TempWorkdir $workDir
        $runEvidence.Cleanup.ContainerResidueCount = $residue.Containers.Count
        $runEvidence.Cleanup.VolumeResidueCount = $residue.Volumes.Count
        if ($residue.Containers.Count -gt 0 -or $residue.Volumes.Count -gt 0) {
          $cleanupFailures.Add('isolated cleanup left project-scoped Docker residue')
        }
      } catch {
        $runEvidence.Cleanup.ContainerResidueCount = -1
        $runEvidence.Cleanup.VolumeResidueCount = -1
        $cleanupFailures.Add("residue inspection: $($_.Exception.Message)")
      }
    } else {
      $runEvidence.Cleanup.ContainerResidueCount = 0
      $runEvidence.Cleanup.VolumeResidueCount = 0
    }
    try {
      if (Test-Path -LiteralPath $workDir) {
        Remove-Item -LiteralPath $workDir -Recurse -Force
      }
      $runEvidence.Cleanup.TempWorkdirResidueCount = if (Test-Path -LiteralPath $workDir) { 1 } else { 0 }
      $runEvidence.Cleanup.RawArtifactResidueCount = $runEvidence.Cleanup.TempWorkdirResidueCount
      $runEvidence.Cleanup.IntermediateConcurrencyEvidenceResidueCount = $runEvidence.Cleanup.TempWorkdirResidueCount
      if ($runEvidence.Cleanup.TempWorkdirResidueCount -ne 0) {
        $cleanupFailures.Add('isolated TEMP workdir was not removed')
      }
    } catch {
      $runEvidence.Cleanup.TempWorkdirResidueCount = -1
      $runEvidence.Cleanup.RawArtifactResidueCount = -1
      $runEvidence.Cleanup.IntermediateConcurrencyEvidenceResidueCount = -1
      $cleanupFailures.Add("TEMP cleanup: $($_.Exception.Message)")
    }
  }

  $runEvidence.CleanupStatus = if ($cleanupFailures.Count -eq 0) { 'PASS' } else { 'FAIL' }
  $runEvidence.PostMigrationFailures = @($postMigrationFailures)
  Write-SanitizedEvidence -Evidence $runEvidence -EvidencePath $evidencePath

  $oracleRecord = $runEvidence.Suites.TEST_ORACLE
  $oracleRecord.Started = $true
  $oracleRecord.PlannedAssertions = 1
  $oracleRecord.ObservedAssertions = 1
  $oracleRecord.ScenarioIds = @('TEST_ORACLE')
  try {
    New-Item -ItemType Directory -Force -Path $oracleLogsDir | Out-Null
    $oracleResult = Invoke-ExternalCommand -Executable 'powershell' -Arguments @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $templateRoot 'scripts\verify-test-evidence.ps1'), '-SuiteEvidencePath', $evidencePath) -LogDirectory $oracleLogsDir -LogName "run-$RunNumber-oracle" -WorkingDirectory $repoRoot -TimeoutSeconds 120
    $oracleRecord.Completed = -not $oracleResult.TimedOut
    $oracleRecord.ExitCode = $oracleResult.ExitCode
    if ($oracleResult.TimedOut) {
      $oracleRecord.Status = 'TIMEOUT'
      $oracleRecord.FailedAssertions = 1
      $oracleRecord.SanitizedFirstError = Protect-SensitiveText -Text $oracleResult.FirstCausalError
      $oracleRecord.Detail = 'Final evidence oracle timed out.'
    } elseif ($oracleResult.ExitCode -eq 0) {
      $oracleRecord.Status = 'PASS'
      $oracleRecord.PassedAssertions = 1
      $oracleRecord.Detail = 'Finalized test, concurrency, and cleanup evidence satisfied the strict oracle.'
    } else {
      $oracleRecord.Status = 'FAIL'
      $oracleRecord.FailedAssertions = 1
      $oracleRecord.SanitizedFirstError = Protect-SensitiveText -Text $oracleResult.FirstCausalError
      $oracleRecord.Detail = 'Final evidence oracle failed.'
    }
  } catch {
    $oracleRecord.Completed = $false
    $oracleRecord.Status = 'FAIL'
    $oracleRecord.FailedAssertions = 1
    $oracleRecord.SanitizedFirstError = Protect-SensitiveText -Text $_.Exception.Message
    $oracleRecord.Detail = 'Final evidence oracle could not execute.'
  } finally {
    try {
      if (Test-Path -LiteralPath $oracleLogsDir) {
        Remove-Item -LiteralPath $oracleLogsDir -Recurse -Force
      }
      if (Test-Path -LiteralPath $oracleLogsDir) {
        $cleanupFailures.Add('final oracle raw logs were not removed')
      }
    } catch {
      $cleanupFailures.Add("final oracle log cleanup: $($_.Exception.Message)")
    }
  }
  if ($cleanupFailures.Count -gt 0) {
    $runEvidence.CleanupStatus = 'FAIL'
    $oracleRecord.Status = 'FAIL'
    $oracleRecord.FailedAssertions = 1
    $oracleRecord.Detail = 'Final evidence oracle cannot pass when cleanup is incomplete.'
  }
  $runEvidence.Suites.TEST_ORACLE = $oracleRecord
  "RUN_$($RunNumber)_TEST_ORACLE=$($oracleRecord.Status)"
  if ($oracleRecord.Status -ne 'PASS') {
    $postMigrationFailures.Add("[TEST_ORACLE_INCOMPLETE] $($oracleRecord.SanitizedFirstError)")
  }
  $runEvidence.PostMigrationFailures = @($postMigrationFailures)

  $aggregateFailure = if ($null -ne $primaryFailure) {
    $primaryFailure
  } elseif ($postMigrationFailures.Count -gt 0) {
    $postMigrationFailures -join [Environment]::NewLine
  } else {
    $null
  }
  $runEvidence.OverallStatus = if ($null -eq $aggregateFailure -and $cleanupFailures.Count -eq 0 -and $oracleRecord.Status -eq 'PASS') { 'PASS' } else { 'FAIL' }
  Write-SanitizedEvidence -Evidence $runEvidence -EvidencePath $evidencePath
  if ($runEvidence.OverallStatus -eq 'PASS') {
    "RUN_$($RunNumber)_RESULT_R01_R23=PASS"
    "RUN_$($RunNumber)_TRACK_T01_T14=PASS"
    "RUN_$($RunNumber)_CONCURRENCY_C01_C05=PASS"
    "SEC05_ISOLATED_RUN_$RunNumber=PASS"
  }

  if ($null -ne $aggregateFailure) {
    if ($cleanupFailures.Count -gt 0) {
      throw ($aggregateFailure + [Environment]::NewLine + '[CLEANUP_FAILED] ' + ($cleanupFailures -join '; '))
    }
    throw $aggregateFailure
  }
  if ($cleanupFailures.Count -gt 0) {
    throw ('[CLEANUP_FAILED] ' + ($cleanupFailures -join '; '))
  }
}

if ($RunTimeoutRegression) {
  $regressionRoot = Join-Path $env:TEMP ("kbeauty-sec05-isolated-timeout-regression-" + [Guid]::NewGuid().ToString('N'))
  try {
    New-Item -ItemType Directory -Force -Path $regressionRoot | Out-Null
    $concurrencyLog = Join-Path $regressionRoot 'concurrency.log'
    $structuredEvidencePath = Join-Path $regressionRoot 'concurrency-sanitized.json'
    [System.IO.File]::WriteAllText($concurrencyLog, "C01=PASS`r`nC02=PASS`r`nC03=TIMEOUT`r`nC04=NOT_RUN`r`nC05=NOT_RUN`r`nT11=NOT_RUN`r`nT12=NOT_RUN`r`n", $utf8NoBom)
    $timeoutWorker = [pscustomobject]@{ WorkerIndex = 1; Classification = 'TIMEOUT'; ExitCode = -1; TimedOut = $true; UuidLineCount = 0; InsertOneTagCount = 0; InsertZeroTagCount = 0; HasUnexpectedStdErr = $false; SanitizedErrorCode = 'WORKER_TIMEOUT' }
    $structuredEvidence = [pscustomobject]@{
      SchemaVersion = 1
      OverallStatus = 'TIMEOUT'
      HasTimeout = $true
      TimeoutScenarioIds = @('C03')
      Scenarios = @(
        [pscustomobject]@{ ScenarioId = 'C01'; Status = 'PASS'; WorkerCount = 8; TimedOutCount = 0; NonZeroExitCount = 0; Metrics = @{} },
        [pscustomobject]@{ ScenarioId = 'C02'; Status = 'PASS'; WorkerCount = 2; TimedOutCount = 0; NonZeroExitCount = 0; Metrics = @{} },
        [pscustomobject]@{ ScenarioId = 'C03'; Status = 'TIMEOUT'; WorkerCount = 8; TimedOutCount = 1; NonZeroExitCount = 1; Workers = @($timeoutWorker) },
        [pscustomobject]@{ ScenarioId = 'C04'; Status = 'NOT_RUN'; WorkerCount = 0; TimedOutCount = 0; NonZeroExitCount = 0; Metrics = @{} },
        [pscustomobject]@{ ScenarioId = 'C05'; Status = 'NOT_RUN'; WorkerCount = 0; TimedOutCount = 0; NonZeroExitCount = 0; Metrics = @{} },
        [pscustomobject]@{ ScenarioId = 'T11'; Status = 'NOT_RUN'; WorkerCount = 0; TimedOutCount = 0; NonZeroExitCount = 0; Metrics = @{} },
        [pscustomobject]@{ ScenarioId = 'T12'; Status = 'NOT_RUN'; WorkerCount = 0; TimedOutCount = 0; NonZeroExitCount = 0; Metrics = @{} }
      )
    }
    [System.IO.File]::WriteAllText($structuredEvidencePath, ($structuredEvidence | ConvertTo-Json -Depth 8), $utf8NoBom)
    $commandResult = [pscustomobject]@{ ExitCode = 124; TimedOut = $false; FirstCausalError = 'worker timeout'; StdoutPath = $concurrencyLog; StderrPath = (Join-Path $regressionRoot 'concurrency.stderr.log') }
    [System.IO.File]::WriteAllText($commandResult.StderrPath, '', $utf8NoBom)
    $record = Get-ConcurrencySuiteEvidence -CommandResult $commandResult -ConcurrencyLogPath $concurrencyLog -StructuredEvidencePath $structuredEvidencePath -TempWorkdir $regressionRoot
    if ($record.Status -ne 'TIMEOUT' -or @($record.FailedScenarioIds) -notcontains 'C03' -or @($record.NotRunScenarioIds) -notcontains 'C04') {
      throw 'Concurrency timeout regression did not trigger the outer TIMEOUT gate.'
    }
    $ordinaryLog = Join-Path $regressionRoot 'ordinary-failure.log'
    $ordinaryStructuredEvidencePath = Join-Path $regressionRoot 'ordinary-failure.json'
    [System.IO.File]::WriteAllText($ordinaryLog, "C01=FAIL`r`nC02=PASS`r`nC03=PASS`r`nC04=PASS`r`nC05=PASS`r`nT11=PASS`r`nT12=PASS`r`n", $utf8NoBom)
    $ordinaryStructuredEvidence = [pscustomobject]@{
      SchemaVersion = 1
      OverallStatus = 'FAIL'
      HasTimeout = $false
      TimeoutScenarioIds = @()
      Scenarios = @('C01', 'C02', 'C03', 'C04', 'C05', 'T11', 'T12' | ForEach-Object {
        [pscustomobject]@{ ScenarioId = $_; Status = if ($_ -eq 'C01') { 'FAIL' } else { 'PASS' }; WorkerCount = 0; TimedOutCount = 0; NonZeroExitCount = 0; Metrics = @{} }
      })
    }
    [System.IO.File]::WriteAllText($ordinaryStructuredEvidencePath, ($ordinaryStructuredEvidence | ConvertTo-Json -Depth 8), $utf8NoBom)
    $ordinaryCommandResult = [pscustomobject]@{ ExitCode = 1; TimedOut = $false; FirstCausalError = 'ordinary assertion failure'; StdoutPath = $ordinaryLog; StderrPath = (Join-Path $regressionRoot 'ordinary-failure.stderr.log') }
    [System.IO.File]::WriteAllText($ordinaryCommandResult.StderrPath, '', $utf8NoBom)
    $ordinaryRecord = Get-ConcurrencySuiteEvidence -CommandResult $ordinaryCommandResult -ConcurrencyLogPath $ordinaryLog -StructuredEvidencePath $ordinaryStructuredEvidencePath -TempWorkdir $regressionRoot
    if ($ordinaryRecord.Status -ne 'FAIL' -or @($ordinaryRecord.PassedScenarioIds) -notcontains 'C05' -or @($ordinaryRecord.FailedScenarioIds) -notcontains 'C01') {
      throw 'Ordinary concurrency failure regression did not preserve continue-and-aggregate evidence.'
    }
    'CONCURRENCY_TIMEOUT_REGRESSION=PASS'
    'CONCURRENCY_ORDINARY_FAILURE_REGRESSION=PASS'
  } finally {
    if (Test-Path -LiteralPath $regressionRoot) { Remove-Item -LiteralPath $regressionRoot -Recurse -Force }
  }
  exit 0
}

foreach ($required in @(
  (Join-Path $templateRoot 'config.toml'),
  (Join-Path $templateRoot 'bootstrap\00000000000000_pre_sec05_minimal_schema.sql'),
  (Join-Path $templateRoot 'tests\001_sec05_structure.sql'),
  (Join-Path $templateRoot 'tests\002_sec05_privileges_rls.sql'),
  (Join-Path $templateRoot 'tests\003_sec05_result_state_machine.sql'),
  (Join-Path $templateRoot 'tests\004_sec05_track_state_machine.sql')
)) { Assert-Path -Path $required -Label 'Harness template file' }

for ($run = 1; $run -le $Runs; $run++) {
  try {
    Invoke-IsolatedRun -RunNumber $run
  } catch {
    $runFailures += "run ${run}: $($_.Exception.Message)"
    "SEC05_ISOLATED_RUN_$run=FAIL"
    break
  }
}

if ($runFailures.Count -gt 0) {
  throw ($runFailures -join [Environment]::NewLine)
}

"SEC05_ISOLATED_FULL_PASS=$Runs"
