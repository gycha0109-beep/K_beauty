# Offline inspection of policy function identifiers in an immutable owner ZIP.
# No SQL text, data rows, passwords, DB connections, Docker, or network.
[CmdletBinding()]
param(
  [string]$BackupZip = (Join-Path (Join-Path $HOME 'BEJEWELY_Private_DB_Backups') 'BEJEWELY_DB_Backup_20261018_181006.zip'),
  [int]$FirstErrorLine = 36502,
  [int]$ErrorCount = 20,
  [int]$ErrorLineStep = 4,
  [long]$ExpectedZipBytes = 7323679,
  [string]$ExpectedSha256 = 'A3E290AE2368D1032786A2202E60B1E328341B8A9C7DFAD1FD9A0F2DABEAD2C6'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$zip = $null
$reader = $null
try {
  if ($FirstErrorLine -lt 1 -or $ErrorCount -lt 1 -or $ErrorCount -gt 80 -or
      $ErrorLineStep -lt 1 -or $ErrorLineStep -gt 20) { throw 'INVALID_BOUNDS' }
  $file = Get-Item -LiteralPath $BackupZip -ErrorAction Stop
  if ($file.PSIsContainer -or $file.Length -ne $ExpectedZipBytes -or $file.Length -le 1024) { throw 'ZIP_SIZE_MISMATCH' }
  if ($ExpectedSha256 -notmatch '^[0-9a-fA-F]{64}$') { throw 'BAD_HASH_ARGUMENT' }
  if ((Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash -ine $ExpectedSha256) { throw 'ZIP_HASH_MISMATCH' }
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($file.FullName)
  if (@($zip.Entries).Count -ne 3 -or
      (@($zip.Entries | Where-Object { @('roles.sql','schema.sql','data.sql') -cnotcontains $_.FullName })).Count -gt 0) {
    throw 'UNEXPECTED_ARCHIVE'
  }
  $entry = $zip.Entries | Where-Object { $_.FullName -ceq 'schema.sql' } | Select-Object -First 1
  if ($null -eq $entry -or $entry.Length -gt 1073741824 -or $entry.Length -le 0) { throw 'SCHEMA_MISSING' }
  $reader = [System.IO.StreamReader]::new($entry.Open(),[System.Text.UTF8Encoding]::new($false),$true)
  $lines = New-Object 'System.Collections.Generic.List[string]'
  while (($line = $reader.ReadLine()) -ne $null) { $lines.Add($line) }
  $heads = [regex]'(?i)^[ \t]*CREATE\s+POLICY\b'
  $refPattern = [regex]'(?i)(?<ns>[a-z_][a-z0-9_]{0,62})\s*\.\s*(?<routine>[a-z_][a-z0-9_]{0,62})\s*\('
  $declarationPrefix = '(?im)^[ \t]*CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+'
  $schemaText = [string]::Join([Environment]::NewLine, $lines)
  $counts = @{}
  $policyHeadPositions = New-Object 'System.Collections.Generic.HashSet[int]'
  $unqualifiedOrDynamicPossible = $false
  for ($i=0; $i -lt $ErrorCount; $i++) {
    $target = $FirstErrorLine + $ErrorLineStep*$i
    if ($target -gt $lines.Count) { throw 'ERROR_LINE_OUT_OF_RANGE' }
    $head = -1
    for ($j=$target-1; $j -ge [Math]::Max(0,$target-13); $j--) {
      if ($heads.IsMatch($lines[$j])) { $head=$j; break }
    }
    if ($head -lt 0 -or -not $policyHeadPositions.Add($head)) { throw 'CREATE_POLICY_BOUNDARY_UNVERIFIED' }
    $statement = [string]::Join([Environment]::NewLine,@($lines.GetRange($head,$target-$head)))
    $seen = @{}
    foreach ($m in $refPattern.Matches($statement)) {
      $schema = $m.Groups['ns'].Value.ToLowerInvariant()
      $routine = $m.Groups['routine'].Value.ToLowerInvariant()
      $name = $schema + '.' + $routine
      if (-not $seen.ContainsKey($name)) {
        $seen[$name]=$true
        if (-not $counts.ContainsKey($name)) { $counts[$name]=0 }
        $counts[$name]++
      }
    }
    if ($seen.Count -eq 0) { $unqualifiedOrDynamicPossible=$true }
  }
  if ($counts.Count -gt 40) { throw 'TOO_MANY_DISTINCT_FUNCTION_REFERENCES' }
  $references = @($counts.Keys | Sort-Object | ForEach-Object {
    $identifier = $_
    $segments = $identifier.Split('.')
    $routineDeclarationPattern = $declarationPrefix + '"?' +
      [regex]::Escape($segments[0]) + '"?\s*\.\s*"?'+
      [regex]::Escape($segments[1]) + '"?\s*\('
    $sourceDeclaration = [regex]::IsMatch($schemaText,$routineDeclarationPattern)
    $family = 'OTHER_OR_CUSTOM'
    if ($segments[0] -eq 'auth') { $family='SUPABASE_AUTH' }
    elseif ($segments[0] -eq 'public') { $family='PUBLIC' }
    elseif ($segments[0] -in @('extensions','vault','storage','realtime','graphql')) { $family='SUPABASE_MANAGED_OR_EXTENSION' }
    [ordered]@{
      functionIdentifier=$identifier
      referencedByPolicies=[int]$counts[$identifier]
      declaredInSourceSchemaDump=[bool]$sourceDeclaration
      namespaceFamily=$family
    }
  })
  $common = @($references | Where-Object { $_.referencedByPolicies -eq $ErrorCount } |
    ForEach-Object { $_.functionIdentifier })
  [ordered]@{
    status='D8K13_POLICY_REFERENCE_INVENTORY_LOCAL_ONLY'
    inspectedPolicyCount=$ErrorCount
    firstErrorLine=$FirstErrorLine
    lastErrorLine=($FirstErrorLine+($ErrorCount-1)*$ErrorLineStep)
    uniqueQualifiedReferenceCount=$counts.Count
    references=$references
    sharedAcrossAllPolicies=$common
    unresolvedUnqualifiedOrDynamicReferencesPossible=$unqualifiedOrDynamicPossible
    declarationCheckIsLexicalOnly=$true
    functionExistsInIsolatedRuntimeVerified=$false
    rawSqlReturned=$false
    originalZipModified=$false
    dataSqlExecuted=$false
    productionDatabaseConnections=0
    releaseAuthorized=$false
  } | ConvertTo-Json -Compress -Depth 6
} catch {
  [Console]::Error.WriteLine('D8K13_POLICY_REFERENCE_INVENTORY_FAILED')
  exit 3
} finally {
  if ($reader) { $reader.Dispose() }
  if ($zip) { $zip.Dispose() }
}
