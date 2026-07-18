[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$SuiteEvidencePath
)

$ErrorActionPreference = 'Stop'

function Get-RequiredProperty {
  param(
    [Parameter(Mandatory = $true)][object]$Object,
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Context
  )

  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) { throw "Missing $Name in $Context." }
  return ,$property.Value
}

function Get-RequiredNonNullProperty {
  param(
    [Parameter(Mandatory = $true)][object]$Object,
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Context
  )

  $value = Get-RequiredProperty -Object $Object -Name $Name -Context $Context
  if ($null -eq $value) { throw "$Context.$Name must not be null." }
  return ,$value
}

function Assert-StringEqual {
  param(
    [Parameter(Mandatory = $true)][AllowEmptyString()]$Value,
    [Parameter(Mandatory = $true)][string]$Expected,
    [Parameter(Mandatory = $true)][string]$Context
  )

  if ($Value -isnot [string]) { throw "$Context expected JSON string '$Expected' but found $($Value.GetType().FullName)." }
  if ($Value -cne $Expected) { throw "$Context expected string '$Expected' but found an unexpected string value." }
}

function Assert-StringOneOf {
  param(
    [Parameter(Mandatory = $true)][AllowEmptyString()]$Value,
    [Parameter(Mandatory = $true)][string[]]$Expected,
    [Parameter(Mandatory = $true)][string]$Context
  )

  if ($Value -isnot [string]) { throw "$Context expected JSON string but found $($Value.GetType().FullName)." }
  if ($Value -cnotin $Expected) { throw "$Context found an unexpected string value." }
}

function Assert-BooleanEqual {
  param(
    [Parameter(Mandatory = $true)]$Value,
    [Parameter(Mandatory = $true)][bool]$Expected,
    [Parameter(Mandatory = $true)][string]$Context
  )

  if ($Value -isnot [bool]) { throw "$Context expected JSON boolean $Expected but found $($Value.GetType().FullName)." }
  if ($Value -ne $Expected) { throw "$Context expected $Expected but found $Value." }
}

function Assert-Array {
  param(
    [Parameter(Mandatory = $true)][AllowEmptyCollection()]$Value,
    [Parameter(Mandatory = $true)][string]$Context
  )

  if ($Value -isnot [System.Array]) { throw "$Context expected JSON array but found $($Value.GetType().FullName)." }
}

function Assert-Object {
  param(
    [Parameter(Mandatory = $true)]$Value,
    [Parameter(Mandatory = $true)][string]$Context
  )

  if ($Value -isnot [System.Management.Automation.PSCustomObject]) { throw "$Context expected JSON object but found $($Value.GetType().FullName)." }
}

function Assert-Integer {
  param(
    [Parameter(Mandatory = $true)]$Value,
    [Parameter(Mandatory = $true)][string]$Context
  )

  if ($Value -isnot [byte] -and $Value -isnot [int] -and $Value -isnot [long]) {
    throw "$Context expected JSON integer but found $($Value.GetType().FullName)."
  }
}

function Assert-IntegerEqual {
  param(
    [Parameter(Mandatory = $true)]$Value,
    [Parameter(Mandatory = $true)][int]$Expected,
    [Parameter(Mandatory = $true)][string]$Context
  )

  Assert-Integer -Value $Value -Context $Context
  if ([int64]$Value -ne $Expected) { throw "$Context expected $Expected but found $Value." }
}

function Assert-StringArrayEqual {
  param(
    [Parameter(Mandatory = $true)][AllowEmptyCollection()]$Value,
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][string[]]$Expected,
    [Parameter(Mandatory = $true)][string]$Context
  )

  Assert-Array -Value $Value -Context $Context
  if ($Value.Count -ne $Expected.Count) { throw "$Context expected $($Expected.Count) entries but found $($Value.Count)." }
  for ($index = 0; $index -lt $Expected.Count; $index++) {
    Assert-StringEqual -Value $Value[$index] -Expected $Expected[$index] -Context "$Context[$index]"
  }
}

function Assert-IntegerArrayEqual {
  param(
    [Parameter(Mandatory = $true)][AllowEmptyCollection()]$Value,
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][int[]]$Expected,
    [Parameter(Mandatory = $true)][string]$Context
  )

  Assert-Array -Value $Value -Context $Context
  if ($Value.Count -ne $Expected.Count) { throw "$Context expected $($Expected.Count) entries but found $($Value.Count)." }
  for ($index = 0; $index -lt $Expected.Count; $index++) {
    Assert-IntegerEqual -Value $Value[$index] -Expected $Expected[$index] -Context "$Context[$index]"
  }
}

function Assert-PassScenarioResults {
  param(
    [Parameter(Mandatory = $true)][AllowEmptyCollection()]$Value,
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][string[]]$ExpectedScenarioIds,
    [Parameter(Mandatory = $true)][string]$Context
  )

  Assert-Array -Value $Value -Context $Context
  if ($Value.Count -ne $ExpectedScenarioIds.Count) { throw "$Context expected $($ExpectedScenarioIds.Count) entries but found $($Value.Count)." }
  for ($index = 0; $index -lt $ExpectedScenarioIds.Count; $index++) {
    $scenario = $Value[$index]
    Assert-Object -Value $scenario -Context "$Context[$index]"
    Assert-StringEqual -Value (Get-RequiredNonNullProperty -Object $scenario -Name 'Id' -Context "$Context[$index]") -Expected $ExpectedScenarioIds[$index] -Context "$Context[$index].Id"
    Assert-IntegerEqual -Value (Get-RequiredNonNullProperty -Object $scenario -Name 'AssertionNumber' -Context "$Context[$index]") -Expected ($index + 1) -Context "$Context[$index].AssertionNumber"
    Assert-StringEqual -Value (Get-RequiredNonNullProperty -Object $scenario -Name 'Status' -Context "$Context[$index]") -Expected 'PASS' -Context "$Context[$index].Status"
  }
}

function Assert-SuiteEvidence {
  param(
    [Parameter(Mandatory = $true)][object]$Evidence,
    [Parameter(Mandatory = $true)][string]$SuiteId,
    [Parameter(Mandatory = $true)][int]$Plan,
    [Parameter(Mandatory = $true)][string[]]$ScenarioIds
  )

  Assert-Object -Value $Evidence -Context 'evidence'
  $suites = Get-RequiredNonNullProperty -Object $Evidence -Name 'Suites' -Context 'evidence'
  Assert-Object -Value $suites -Context 'evidence.Suites'
  $suite = Get-RequiredNonNullProperty -Object $suites -Name $SuiteId -Context 'evidence.Suites'
  Assert-Object -Value $suite -Context "evidence.Suites.$SuiteId"
  Assert-StringEqual -Value (Get-RequiredNonNullProperty -Object $suite -Name 'SuiteId' -Context "evidence.Suites.$SuiteId") -Expected $SuiteId -Context "$SuiteId SuiteId"
  Assert-StringEqual -Value (Get-RequiredNonNullProperty -Object $suite -Name 'Status' -Context "evidence.Suites.$SuiteId") -Expected 'PASS' -Context "$SuiteId Status"
  Assert-BooleanEqual -Value (Get-RequiredNonNullProperty -Object $suite -Name 'Started' -Context "evidence.Suites.$SuiteId") -Expected $true -Context "$SuiteId Started"
  Assert-BooleanEqual -Value (Get-RequiredNonNullProperty -Object $suite -Name 'Completed' -Context "evidence.Suites.$SuiteId") -Expected $true -Context "$SuiteId Completed"
  Assert-IntegerEqual -Value (Get-RequiredNonNullProperty -Object $suite -Name 'ExitCode' -Context "evidence.Suites.$SuiteId") -Expected 0 -Context "$SuiteId ExitCode"
  Assert-IntegerEqual -Value (Get-RequiredNonNullProperty -Object $suite -Name 'PlannedAssertions' -Context "evidence.Suites.$SuiteId") -Expected $Plan -Context "$SuiteId planned assertions"
  Assert-IntegerEqual -Value (Get-RequiredNonNullProperty -Object $suite -Name 'ObservedAssertions' -Context "evidence.Suites.$SuiteId") -Expected $Plan -Context "$SuiteId observed assertions"
  Assert-IntegerEqual -Value (Get-RequiredNonNullProperty -Object $suite -Name 'PassedAssertions' -Context "evidence.Suites.$SuiteId") -Expected $Plan -Context "$SuiteId passed assertions"
  Assert-IntegerEqual -Value (Get-RequiredNonNullProperty -Object $suite -Name 'FailedAssertions' -Context "evidence.Suites.$SuiteId") -Expected 0 -Context "$SuiteId failed assertions"
  $expectedAssertionNumbers = @(1..$Plan)
  Assert-IntegerArrayEqual -Value (Get-RequiredNonNullProperty -Object $suite -Name 'ObservedAssertionNumbers' -Context "evidence.Suites.$SuiteId") -Expected $expectedAssertionNumbers -Context "$SuiteId ObservedAssertionNumbers"
  Assert-IntegerArrayEqual -Value (Get-RequiredNonNullProperty -Object $suite -Name 'PassedAssertionNumbers' -Context "evidence.Suites.$SuiteId") -Expected $expectedAssertionNumbers -Context "$SuiteId PassedAssertionNumbers"
  Assert-IntegerArrayEqual -Value (Get-RequiredNonNullProperty -Object $suite -Name 'FailedAssertionNumbers' -Context "evidence.Suites.$SuiteId") -Expected @() -Context "$SuiteId FailedAssertionNumbers"
  Assert-IntegerArrayEqual -Value (Get-RequiredNonNullProperty -Object $suite -Name 'MissingAssertionNumbers' -Context "evidence.Suites.$SuiteId") -Expected @() -Context "$SuiteId MissingAssertionNumbers"
  Assert-StringArrayEqual -Value (Get-RequiredNonNullProperty -Object $suite -Name 'ScenarioIds' -Context "evidence.Suites.$SuiteId") -Expected $ScenarioIds -Context "$SuiteId ScenarioIds"
  Assert-StringArrayEqual -Value (Get-RequiredNonNullProperty -Object $suite -Name 'PassedScenarioIds' -Context "evidence.Suites.$SuiteId") -Expected $ScenarioIds -Context "$SuiteId PassedScenarioIds"
  Assert-StringArrayEqual -Value (Get-RequiredNonNullProperty -Object $suite -Name 'FailedScenarioIds' -Context "evidence.Suites.$SuiteId") -Expected @() -Context "$SuiteId FailedScenarioIds"
  Assert-StringArrayEqual -Value (Get-RequiredNonNullProperty -Object $suite -Name 'NotRunScenarioIds' -Context "evidence.Suites.$SuiteId") -Expected @() -Context "$SuiteId NotRunScenarioIds"
  Assert-PassScenarioResults -Value (Get-RequiredNonNullProperty -Object $suite -Name 'ScenarioResults' -Context "evidence.Suites.$SuiteId") -ExpectedScenarioIds $ScenarioIds -Context "$SuiteId ScenarioResults"
}

function Assert-InsertConcurrencyEvidence {
  param(
    [Parameter(Mandatory = $true)][object]$Scenario,
    [Parameter(Mandatory = $true)][string]$ScenarioId
  )

  Assert-Object -Value $Scenario -Context "$ScenarioId structured evidence"
  Assert-StringEqual -Value (Get-RequiredNonNullProperty -Object $Scenario -Name 'ScenarioId' -Context "$ScenarioId structured evidence") -Expected $ScenarioId -Context "$ScenarioId ScenarioId"
  Assert-StringEqual -Value (Get-RequiredNonNullProperty -Object $Scenario -Name 'Status' -Context "$ScenarioId structured evidence") -Expected 'PASS' -Context "$ScenarioId Status"
  foreach ($field in @('WorkerCount', 'WinnerCount', 'NoOpCount', 'InvalidCount', 'TimedOutCount', 'NonZeroExitCount', 'StartLinkedRowCount', 'FinalLinkedRowCount', 'ExpectedWinnerCount', 'ExpectedNoOpCount', 'ExpectedInvalidCount')) {
    Get-RequiredNonNullProperty -Object $Scenario -Name $field -Context "$ScenarioId structured evidence" | Out-Null
  }
  Assert-IntegerEqual -Value $Scenario.WorkerCount -Expected 8 -Context "$ScenarioId worker count"
  Assert-IntegerEqual -Value $Scenario.WinnerCount -Expected 1 -Context "$ScenarioId winner count"
  Assert-IntegerEqual -Value $Scenario.NoOpCount -Expected 7 -Context "$ScenarioId no-op count"
  Assert-IntegerEqual -Value $Scenario.InvalidCount -Expected 0 -Context "$ScenarioId invalid count"
  Assert-IntegerEqual -Value $Scenario.TimedOutCount -Expected 0 -Context "$ScenarioId timeout count"
  Assert-IntegerEqual -Value $Scenario.NonZeroExitCount -Expected 0 -Context "$ScenarioId non-zero exit count"
  Assert-IntegerEqual -Value $Scenario.StartLinkedRowCount -Expected 0 -Context "$ScenarioId start linked row count"
  Assert-IntegerEqual -Value $Scenario.FinalLinkedRowCount -Expected 1 -Context "$ScenarioId final linked row count"
  Assert-IntegerEqual -Value $Scenario.ExpectedWinnerCount -Expected 1 -Context "$ScenarioId expected winner count"
  Assert-IntegerEqual -Value $Scenario.ExpectedNoOpCount -Expected 7 -Context "$ScenarioId expected no-op count"
  Assert-IntegerEqual -Value $Scenario.ExpectedInvalidCount -Expected 0 -Context "$ScenarioId expected invalid count"

  $workersValue = Get-RequiredNonNullProperty -Object $Scenario -Name 'Workers' -Context "$ScenarioId structured evidence"
  Assert-Array -Value $workersValue -Context "$ScenarioId Workers"
  $workers = $workersValue
  if ($workers.Count -ne 8) { throw "$ScenarioId must retain eight sanitized worker records." }
  $indices = @($workers | ForEach-Object { Get-RequiredNonNullProperty -Object $_ -Name 'WorkerIndex' -Context "$ScenarioId worker" })
  Assert-IntegerArrayEqual -Value $indices -Expected @(1..8) -Context "$ScenarioId WorkerIndex"
  $winnerWorkers = @($workers | Where-Object { $_.Classification -eq 'WINNER' })
  $noOpWorkers = @($workers | Where-Object { $_.Classification -eq 'NO_OP' })
  if ($winnerWorkers.Count -ne 1 -or $noOpWorkers.Count -ne 7) { throw "$ScenarioId worker classification aggregate does not match." }

  foreach ($worker in $workers) {
    Assert-Object -Value $worker -Context "$ScenarioId worker"
    foreach ($field in @('WorkerIndex', 'Classification', 'ExitCode', 'TimedOut', 'UuidLineCount', 'InsertOneTagCount', 'InsertZeroTagCount', 'HasUnexpectedStdErr', 'SanitizedErrorCode')) {
      Get-RequiredNonNullProperty -Object $worker -Name $field -Context "$ScenarioId worker" | Out-Null
    }
    if ($worker.Classification -isnot [string] -or $worker.Classification -notin @('WINNER', 'NO_OP')) { throw "$ScenarioId contains an invalid or timeout worker." }
    Assert-IntegerEqual -Value $worker.ExitCode -Expected 0 -Context "$ScenarioId worker exit code"
    Assert-BooleanEqual -Value $worker.TimedOut -Expected $false -Context "$ScenarioId worker TimedOut"
    Assert-BooleanEqual -Value $worker.HasUnexpectedStdErr -Expected $false -Context "$ScenarioId worker HasUnexpectedStdErr"
    if ($worker.Classification -eq 'WINNER') {
      Assert-IntegerEqual -Value $worker.UuidLineCount -Expected 1 -Context "$ScenarioId winner UUID lines"
      Assert-IntegerEqual -Value $worker.InsertOneTagCount -Expected 1 -Context "$ScenarioId winner insert-one tags"
      Assert-IntegerEqual -Value $worker.InsertZeroTagCount -Expected 0 -Context "$ScenarioId winner insert-zero tags"
    } else {
      Assert-IntegerEqual -Value $worker.UuidLineCount -Expected 0 -Context "$ScenarioId no-op UUID lines"
      Assert-IntegerEqual -Value $worker.InsertOneTagCount -Expected 0 -Context "$ScenarioId no-op insert-one tags"
      Assert-IntegerEqual -Value $worker.InsertZeroTagCount -Expected 1 -Context "$ScenarioId no-op insert-zero tags"
    }
  }

  $workerClassificationTotal = @($workers | Where-Object { $_.Classification -eq 'WINNER' }).Count + @($workers | Where-Object { $_.Classification -eq 'NO_OP' }).Count
  Assert-IntegerEqual -Value $workerClassificationTotal -Expected $Scenario.WorkerCount -Context "$ScenarioId worker classification total"
}

function Assert-BasicConcurrencyEvidence {
  param(
    [Parameter(Mandatory = $true)][object]$Scenario,
    [Parameter(Mandatory = $true)][string]$ScenarioId,
    [Parameter(Mandatory = $true)][int]$ExpectedWorkerCount,
    [Parameter(Mandatory = $true)][hashtable]$ExpectedMetrics
  )

  Assert-Object -Value $Scenario -Context "$ScenarioId structured evidence"
  Assert-StringEqual -Value (Get-RequiredNonNullProperty -Object $Scenario -Name 'ScenarioId' -Context "$ScenarioId structured evidence") -Expected $ScenarioId -Context "$ScenarioId ScenarioId"
  Assert-StringEqual -Value (Get-RequiredNonNullProperty -Object $Scenario -Name 'Status' -Context "$ScenarioId structured evidence") -Expected 'PASS' -Context "$ScenarioId Status"
  Assert-IntegerEqual -Value (Get-RequiredNonNullProperty -Object $Scenario -Name 'WorkerCount' -Context "$ScenarioId structured evidence") -Expected $ExpectedWorkerCount -Context "$ScenarioId worker count"
  Assert-IntegerEqual -Value (Get-RequiredNonNullProperty -Object $Scenario -Name 'TimedOutCount' -Context "$ScenarioId structured evidence") -Expected 0 -Context "$ScenarioId timeout count"
  Assert-IntegerEqual -Value (Get-RequiredNonNullProperty -Object $Scenario -Name 'NonZeroExitCount' -Context "$ScenarioId structured evidence") -Expected 0 -Context "$ScenarioId non-zero exit count"

  $metrics = Get-RequiredNonNullProperty -Object $Scenario -Name 'Metrics' -Context "$ScenarioId structured evidence"
  Assert-Object -Value $metrics -Context "$ScenarioId Metrics"
  foreach ($metricName in $ExpectedMetrics.Keys) {
    Assert-IntegerEqual -Value (Get-RequiredNonNullProperty -Object $metrics -Name $metricName -Context "$ScenarioId Metrics") -Expected $ExpectedMetrics[$metricName] -Context "$ScenarioId Metrics.$metricName"
  }
}

if (-not (Test-Path -LiteralPath $SuiteEvidencePath)) { throw "Required evidence file is missing: $SuiteEvidencePath" }
$rawEvidence = Get-Content -LiteralPath $SuiteEvidencePath -Raw
if ($rawEvidence -match '(?i)postgres(?:ql)?://|bearer\s+[A-Za-z0-9._-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|password\s*[:=]|service[_-]?role[_-]?key\s*[:=]|anon[_-]?key\s*[:=]') {
  throw 'Final evidence contains a forbidden secret pattern.'
}
$suiteEvidence = $rawEvidence | ConvertFrom-Json
Assert-Object -Value $suiteEvidence -Context 'evidence'
Assert-StringOneOf -Value (Get-RequiredNonNullProperty -Object $suiteEvidence -Name 'OverallStatus' -Context 'evidence') -Expected @('RUNNING', 'PASS') -Context 'evidence.OverallStatus'
Assert-SuiteEvidence -Evidence $suiteEvidence -SuiteId 'STRUCTURE' -Plan 15 -ScenarioIds @('STRUCTURE')
Assert-SuiteEvidence -Evidence $suiteEvidence -SuiteId 'PRIVILEGE_RLS' -Plan 23 -ScenarioIds @('PRIV_RLS')
Assert-SuiteEvidence -Evidence $suiteEvidence -SuiteId 'RESULT_STATE_MACHINE' -Plan 23 -ScenarioIds @('R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11', 'R12', 'R13', 'R14', 'R15', 'R16', 'R17', 'R18', 'R19', 'R20', 'R21', 'R22', 'R23')
Assert-SuiteEvidence -Evidence $suiteEvidence -SuiteId 'TRACK_STATE_MACHINE' -Plan 13 -ScenarioIds @('T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10', 'T13', 'T14', 'V05')
Assert-SuiteEvidence -Evidence $suiteEvidence -SuiteId 'V05' -Plan 1 -ScenarioIds @('V05')

$expectedConcurrencyScenarioIds = @('C01', 'C02', 'C03', 'C04', 'C05', 'T11', 'T12')
Assert-SuiteEvidence -Evidence $suiteEvidence -SuiteId 'CONCURRENCY' -Plan 7 -ScenarioIds $expectedConcurrencyScenarioIds
$concurrency = Get-RequiredNonNullProperty -Object $suiteEvidence.Suites -Name 'CONCURRENCY' -Context 'evidence.Suites'
$structured = Get-RequiredNonNullProperty -Object $concurrency -Name 'StructuredEvidence' -Context 'concurrency suite'
Assert-Object -Value $structured -Context 'concurrency structured evidence'
Assert-IntegerEqual -Value (Get-RequiredNonNullProperty -Object $structured -Name 'SchemaVersion' -Context 'concurrency structured evidence') -Expected 1 -Context 'concurrency SchemaVersion'
Assert-StringEqual -Value (Get-RequiredNonNullProperty -Object $structured -Name 'OverallStatus' -Context 'concurrency structured evidence') -Expected 'PASS' -Context 'concurrency OverallStatus'
Assert-BooleanEqual -Value (Get-RequiredNonNullProperty -Object $structured -Name 'HasTimeout' -Context 'concurrency structured evidence') -Expected $false -Context 'concurrency HasTimeout'
$timeoutScenarioIds = Get-RequiredNonNullProperty -Object $structured -Name 'TimeoutScenarioIds' -Context 'concurrency structured evidence'
Assert-Array -Value $timeoutScenarioIds -Context 'concurrency TimeoutScenarioIds'
if ($timeoutScenarioIds.Count -ne 0) { throw 'concurrency.TimeoutScenarioIds expected an empty array.' }

$scenariosValue = Get-RequiredNonNullProperty -Object $structured -Name 'Scenarios' -Context 'concurrency structured evidence'
Assert-Array -Value $scenariosValue -Context 'concurrency Scenarios'
$scenarios = $scenariosValue
$expectedScenarioIds = $expectedConcurrencyScenarioIds
if ($scenarios.Count -ne $expectedScenarioIds.Count) { throw "concurrency.Scenarios expected $($expectedScenarioIds.Count) entries but found $($scenarios.Count)." }
$scenarioIds = @()
foreach ($scenario in $scenarios) {
  Assert-Object -Value $scenario -Context 'concurrency scenario'
  $scenarioId = Get-RequiredNonNullProperty -Object $scenario -Name 'ScenarioId' -Context 'concurrency scenario'
  if ($scenarioId -isnot [string] -or $scenarioId -notin $expectedScenarioIds) { throw 'concurrency.Scenarios contains an unknown ScenarioId.' }
  $scenarioIds += $scenarioId
  Assert-StringEqual -Value (Get-RequiredNonNullProperty -Object $scenario -Name 'Status' -Context "$scenarioId structured evidence") -Expected 'PASS' -Context "$scenarioId Status"
}
if (@($scenarioIds | Select-Object -Unique).Count -ne $expectedScenarioIds.Count) { throw 'concurrency.Scenarios contains a duplicate ScenarioId.' }
foreach ($id in $expectedScenarioIds) {
  if (@($scenarioIds | Where-Object { $_ -eq $id }).Count -ne 1) { throw "concurrency.Scenarios is missing $id." }
}

Assert-BasicConcurrencyEvidence -Scenario (@($scenarios | Where-Object { $_.ScenarioId -eq 'C01' })[0]) -ScenarioId 'C01' -ExpectedWorkerCount 8 -ExpectedMetrics @{ ClaimedCount = 1; UseCount = 1; InvalidCount = 0 }
Assert-BasicConcurrencyEvidence -Scenario (@($scenarios | Where-Object { $_.ScenarioId -eq 'C02' })[0]) -ScenarioId 'C02' -ExpectedWorkerCount 2 -ExpectedMetrics @{ OwnerCompletedCount = 1; StaleDeniedCount = 1; InvalidCount = 0 }
Assert-InsertConcurrencyEvidence -Scenario (@($scenarios | Where-Object { $_.ScenarioId -eq 'C03' })[0]) -ScenarioId 'C03'
Assert-InsertConcurrencyEvidence -Scenario (@($scenarios | Where-Object { $_.ScenarioId -eq 'C04' })[0]) -ScenarioId 'C04'
Assert-BasicConcurrencyEvidence -Scenario (@($scenarios | Where-Object { $_.ScenarioId -eq 'C05' })[0]) -ScenarioId 'C05' -ExpectedWorkerCount 8 -ExpectedMetrics @{ ClaimedCount = 1; UsedCount = 24; InvalidCount = 0 }
Assert-BasicConcurrencyEvidence -Scenario (@($scenarios | Where-Object { $_.ScenarioId -eq 'T11' })[0]) -ScenarioId 'T11' -ExpectedWorkerCount 0 -ExpectedMetrics @{ UseCount = 1; LogCount = 1; UsedCount = 1 }
Assert-BasicConcurrencyEvidence -Scenario (@($scenarios | Where-Object { $_.ScenarioId -eq 'T12' })[0]) -ScenarioId 'T12' -ExpectedWorkerCount 0 -ExpectedMetrics @{ ClaimedCount = 1; UsedCount = 24 }

Assert-StringEqual -Value (Get-RequiredNonNullProperty -Object $suiteEvidence -Name 'CleanupStatus' -Context 'evidence') -Expected 'PASS' -Context 'CleanupStatus'
$cleanup = Get-RequiredNonNullProperty -Object $suiteEvidence -Name 'Cleanup' -Context 'evidence'
Assert-Object -Value $cleanup -Context 'Cleanup'
foreach ($field in @('TempWorkdirResidueCount', 'ContainerResidueCount', 'VolumeResidueCount', 'RawArtifactResidueCount', 'IntermediateConcurrencyEvidenceResidueCount')) {
  Assert-IntegerEqual -Value (Get-RequiredProperty -Object $cleanup -Name $field -Context 'cleanup') -Expected 0 -Context "cleanup $field"
}

'TEST_ORACLE=FULLY_OBSERVED'
