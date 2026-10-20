# Classify one failed psql source line from a PRIVATE local ZIP without returning SQL.
# Metadata-only / no Docker / no DB / no network / no upload / no ZIP modification.
[CmdletBinding()]
param(
  [string] $BackupZip = (Join-Path (Join-Path $HOME 'BEJEWELY_Private_DB_Backups') 'BEJEWELY_DB_Backup_20261018_181006.zip'),
  [ValidateRange(1,1000000)][int] $LineNumber = 22086,
  [long] $ExpectedZipBytes = 7323679,
  [string] $ExpectedSha256 = 'A3E290AE2368D1032786A2202E60B1E328341B8A9C7DFAD1FD9A0F2DABEAD2C6'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$archive = $null
$reader = $null
$stream = $null
try {
  $file = Get-Item -LiteralPath $BackupZip -ErrorAction Stop
  if ($file.PSIsContainer -or $file.Length -le 1024) { throw 'INVALID_ARCHIVE' }
  if ($ExpectedZipBytes -gt 0 -and [long] $file.Length -ne $ExpectedZipBytes) { throw 'ARCHIVE_SIZE_MISMATCH' }
  if ($ExpectedSha256 -ne '') {
    if ($ExpectedSha256 -notmatch '^[0-9A-Fa-f]{64}$') { throw 'INVALID_EXPECTED_HASH' }
    $digest = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
    if ($digest -ine $ExpectedSha256) { throw 'ARCHIVE_SHA256_MISMATCH' }
  }
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($file.FullName)
  $names = @($archive.Entries | ForEach-Object { $_.FullName })
  if ($names.Count -ne 3 -or
      (@($names | Where-Object { @('roles.sql','schema.sql','data.sql') -cnotcontains $_ })).Count -ne 0 -or
      (@($names | Sort-Object -Unique)).Count -ne 3) { throw 'ARCHIVE_FILE_SET_MISMATCH' }
  $entry = $archive.Entries | Where-Object { $_.FullName -ceq 'schema.sql' } | Select-Object -First 1
  if ($null -eq $entry -or $entry.Length -gt 1073741824 -or $entry.Length -le 0) { throw 'SCHEMA_ENTRY_INVALID' }
  $stream = $entry.Open()
  $reader = [System.IO.StreamReader]::new($stream,[System.Text.UTF8Encoding]::new($false),$true)
  $physicalLine = 0
  $statementLine = 0
  $statementText = ''
  $targetText = ''
  # psql reports a PHYSICAL source line. Keep only the most recent lexical SQL
  # command head and the requested line in memory. Never print either one.
  while (($line = $reader.ReadLine()) -ne $null) {
    $physicalLine++
    if ($line -match '^(?:ALTER|CREATE|GRANT|REVOKE|COMMENT|SET|RESET|DROP|SELECT|DO|SECURITY|REASSIGN|REFRESH|TRUNCATE)\b') {
      $statementLine = $physicalLine
      $statementText = $line
    }
    if ($physicalLine -eq $LineNumber) {
      $targetText = $line
      break
    }
  }
  if ($physicalLine -lt $LineNumber) { throw 'REQUESTED_LINE_NOT_IN_SCHEMA' }
  $head = $statementText.Trim()
  $verb = 'UNKNOWN'
  if ($head -match '^(ALTER|CREATE|GRANT|REVOKE|COMMENT|SET|RESET|DROP|SELECT|DO|SECURITY|REASSIGN|REFRESH|TRUNCATE)\b') {
    $verb = $Matches[1].ToUpperInvariant()
  }
  $object = 'UNKNOWN'
  if ($head -match '^(?:ALTER|CREATE|DROP|COMMENT\s+ON)\s+(DEFAULT\s+PRIVILEGES|MATERIALIZED\s+VIEW|FOREIGN\s+TABLE|EVENT\s+TRIGGER|TABLE|FUNCTION|PROCEDURE|SEQUENCE|VIEW|SCHEMA|TYPE|EXTENSION|DATABASE|POLICY|TRIGGER|ROLE|INDEX)\b') {
    $object = ($Matches[1].ToUpperInvariant() -replace '\s+','_')
  } elseif ($head -match '^(?:GRANT|REVOKE)\b[^\r\n]*?\bON\s+(?:ALL\s+)?(TABLES?|SEQUENCES?|FUNCTIONS?|SCHEMAS?|DATABASES?|TYPES?)\b') {
    $object = $Matches[1].ToUpperInvariant()
  }
  $operation = 'OTHER_OR_UNKNOWN'
  if ($verb -in @('GRANT','REVOKE')) { $operation = $verb }
  elseif ($head -match '^(?:ALTER|CREATE)\s+DEFAULT\s+PRIVILEGES\b') { $operation = 'DEFAULT_PRIVILEGES' }
  elseif ($head -match '\bOWNER\s+TO\b' -or $targetText -match '^\s*OWNER\s+TO\b') { $operation = 'OWNER_TO' }
  elseif ($verb -eq 'ALTER') { $operation = 'ALTER_OTHER' }
  elseif ($verb -eq 'CREATE') { $operation = 'CREATE_OTHER' }
  # These are fixed allowlisted flags; never return schema names, role names,
  # source line text, SQL fragments, hash of a line, or any contents of the ZIP.
  $isPrivate = [bool](($head -match '(?i)\bprivate\b') -or ($targetText -match '(?i)\bprivate\b'))
  $isKnownRole = [bool](($head -match '(?i)\bproduct_offer_link_health_recorder_owner\b') -or ($targetText -match '(?i)\bproduct_offer_link_health_recorder_owner\b'))
  [ordered]@{
    status = 'D8K13_LOCAL_SCHEMA_LINE_CLASSIFIED_METADATA_ONLY'
    inspectedPhysicalLine = $LineNumber
    nearestTopLevelCommandLine = $statementLine
    verb = $verb
    objectKind = $object
    operation = $operation
    mentionsKnownPrivateSchema = $isPrivate
    mentionsKnownFunctionOwnerRole = $isKnownRole
    classificationConfidence = 'LEXICAL_HEURISTIC_NOT_SQL_PARSER'
    rawSqlReturned = $false
    rawZipUploaded = $false
    productionConnections = 0
    restoreCompleted = $false
    permissionsAuthorizedToChange = $false
    releaseAuthorized = $false
  } | ConvertTo-Json -Compress
} catch {
  # Never surface .Exception.Message: it could embed local paths or source.
  [Console]::Error.WriteLine('D8K13_LOCAL_SCHEMA_LINE_CLASSIFICATION_FAILED')
  exit 3
} finally {
  if ($reader) { $reader.Dispose() }
  elseif ($stream) { $stream.Dispose() }
  if ($archive) { $archive.Dispose() }
}
