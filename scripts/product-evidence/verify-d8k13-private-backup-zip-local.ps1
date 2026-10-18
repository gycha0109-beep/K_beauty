# D8K13 owner-side backup ZIP inspection and OPTIONAL isolated PostgreSQL 17 restore.
# No Supabase connection, network port, bind mount, raw SQL output or GitHub upload.
# Intended for Windows PowerShell 5.1+ / PowerShell 7 with Docker Desktop.
[CmdletBinding()]
param(
  [string] $BackupZip = (Join-Path (Join-Path $HOME 'BEJEWELY_Private_DB_Backups') 'BEJEWELY_DB_Backup_20261018_181006.zip'),
  [ValidateSet('Inspect','Restore')][string] $Mode = 'Inspect',
  [long] $ExpectedZipBytes = 7323679
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$required = @('roles.sql', 'schema.sql', 'data.sql')
$unpacked = $null
$zipReader = $null
$container = $null
$containerStarted = $false
function Assert-Drill([bool]$test,[string]$code) {
  if (-not $test) { throw $code }
}
function Run-Docker([string]$stage,[string[]]$arguments) {
  $log = Join-Path $unpacked ('docker-' + $stage + '.log')
  & docker @arguments 1> $log 2>&1
  $code = $LASTEXITCODE
  if ($code -ne 0) {
    # Do not print raw restore logs: PostgreSQL errors may contain sensitive SQL values.
    throw ('D8K13_LOCAL_RESTORE_' + $stage + '_FAILED_EXIT_' + $code)
  }
}
function Get-PublicInventory([string]$name) {
  $probe = @'
select json_build_object(
 'pg_major',(select current_setting('server_version_num')::int/10000),
 'tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')),
 'views',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v'),
 'columns',(select count(*) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m') and a.attnum>0 and not a.attisdropped),
 'foreign_keys',(select count(*) from pg_constraint k join pg_namespace n on n.oid=k.connamespace where n.nspname='public' and k.contype='f'),
 'routines',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
 'rls_enabled',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relrowsecurity),
 'policies',(select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'),
 'product_rows',(select case when to_regclass('public.products') is null then null else (select count(*) from public.products) end)
)
'@
  # The probe intentionally returns aggregate metadata/counts only, never user rows.
  $answer = & docker exec -u postgres $name psql -X -A -t -v ON_ERROR_STOP=1 -d postgres -c $probe 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'D8K13_LOCAL_RESTORE_METADATA_PROBE_FAILED' }
  return ($answer | Select-Object -Last 1 | ConvertFrom-Json)
}
try {
  $file = Get-Item -LiteralPath $BackupZip -ErrorAction Stop
  Assert-Drill (-not $file.PSIsContainer) 'D8K13_BACKUP_PATH_MUST_BE_FILE'
  $actualBytes = [long]$file.Length
  Assert-Drill ($actualBytes -gt 1024) 'D8K13_BACKUP_ZIP_TOO_SMALL'
  if ($ExpectedZipBytes -gt 0) {
    Assert-Drill ($actualBytes -eq $ExpectedZipBytes) 'D8K13_BACKUP_ZIP_SIZE_MISMATCH'
  }
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zipReader = [System.IO.Compression.ZipFile]::OpenRead($file.FullName)
  $members = @($zipReader.Entries)
  Assert-Drill ($members.Count -eq 3) 'D8K13_BACKUP_ZIP_MUST_CONTAIN_EXACTLY_THREE_FILES'
  $total = [long]0
  foreach ($item in $members) {
    # No traversal, directories, nested paths, symlinks or surprise files.
    Assert-Drill ($required -ccontains $item.FullName) 'D8K13_BACKUP_ZIP_UNEXPECTED_PATH'
    Assert-Drill ($item.Length -gt 0 -and $item.Length -le 1073741824) 'D8K13_BACKUP_ZIP_FILE_SIZE_INVALID'
    $total += [long]$item.Length
  }
  Assert-Drill ($total -le 2147483648) 'D8K13_BACKUP_ZIP_TOTAL_SIZE_INVALID'
  foreach ($name in $required) {
    Assert-Drill ((@($members | Where-Object { $_.FullName -ceq $name })).Count -eq 1) ('D8K13_BACKUP_ZIP_MISSING_' + $name)
  }
  $unpacked = Join-Path ([System.IO.Path]::GetTempPath()) ('bejewely-local-restore-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $unpacked -Force | Out-Null
  foreach ($name in $required) {
    $entry = $members | Where-Object { $_.FullName -ceq $name } | Select-Object -First 1
    $dest = Join-Path $unpacked $name
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $dest, $false)
    Assert-Drill ((Get-Item -LiteralPath $dest).Length -eq $entry.Length) ('D8K13_BACKUP_EXTRACT_MISMATCH_' + $name)
  }
  $zipReader.Dispose()
  $zipReader = $null
  $digest = (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash
  $sizes = @{}
  foreach ($name in $required) {
    $sizes[$name] = [long](Get-Item -LiteralPath (Join-Path $unpacked $name)).Length
  }
  Write-Output ([ordered]@{
    status = 'D8K13_LOCAL_ZIP_INSPECTION_PASS'
    zipBytes = $actualBytes
    sha256 = $digest
    sqlBytes = $sizes
    backupSqlContentsUploaded = $false
    productionDatabaseConnections = 0
    actualRestoreCompleted = $false
  } | ConvertTo-Json -Compress -Depth 5)
  if ($Mode -eq 'Inspect') { return }
  Assert-Drill ($null -ne (Get-Command docker -ErrorAction SilentlyContinue)) 'D8K13_DOCKER_NOT_INSTALLED'
  $container = 'bejewely-restore-' + [guid]::NewGuid().ToString('N').Substring(0,12)
  # Disposable PostgreSQL 17, no network, no ports, no host-mounted volumes.
  $password = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))
  $startLog = Join-Path $unpacked 'docker-run.log'
  & docker run --detach --rm --name $container --network none --pids-limit 128 --memory 1g --cpus 2 -e ('POSTGRES_PASSWORD=' + $password) postgres:17.6 1> $startLog 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'D8K13_LOCAL_RESTORE_CONTAINER_START_FAILED' }
  $containerStarted = $true
  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    & docker exec -u postgres $container pg_isready -q -U postgres -d postgres *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  Assert-Drill $ready 'D8K13_LOCAL_RESTORE_POSTGRES_NOT_READY'
  $empty = & docker exec -u postgres $container psql -X -A -t -d postgres -v ON_ERROR_STOP=1 -c "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m','f','S')"
  Assert-Drill ($LASTEXITCODE -eq 0 -and ("$empty".Trim() -eq '0')) 'D8K13_LOCAL_RESTORE_DESTINATION_NOT_EMPTY'
  Run-Docker 'DROP_EMPTY_PUBLIC' @('exec','-u','postgres',$container,'psql','-X','-q','-v','ON_ERROR_STOP=1','-d','postgres','-c','DROP SCHEMA IF EXISTS public CASCADE')
  foreach ($name in $required) {
    Run-Docker ('COPY_' + $name) @('cp',(Join-Path $unpacked $name),($container + ':/tmp/' + $name))
  }
  Run-Docker 'ROLES' @('exec','-u','postgres',$container,'psql','-X','-q','-v','ON_ERROR_STOP=1','--single-transaction','-d','postgres','-f','/tmp/roles.sql')
  Run-Docker 'SCHEMA' @('exec','-u','postgres',$container,'psql','-X','-q','-v','ON_ERROR_STOP=1','--single-transaction','-d','postgres','-f','/tmp/schema.sql')
  Run-Docker 'DATA' @('exec','-u','postgres',$container,'psql','-X','-q','-v','ON_ERROR_STOP=1','--single-transaction','-d','postgres','-c','SET session_replication_role = replica','-f','/tmp/data.sql','-c','RESET session_replication_role')
  $inventory = Get-PublicInventory $container
  Assert-Drill ([int]$inventory.pg_major -eq 17) 'D8K13_LOCAL_RESTORE_WRONG_PG_MAJOR'
  Assert-Drill ([int]$inventory.tables -ge 1) 'D8K13_LOCAL_RESTORE_NO_TABLES'
  # Successful SQL application is not proof of Supabase Auth/Storage/Vault/ACL parity.
  Write-Output ([ordered]@{
    status='D8K13_DISPOSABLE_PG17_SQL_RESTORE_PASS_LIMITED'
    inventory=$inventory
    postgresNetworkDisabled=$true
    rawSQLUploaded=$false
    realBackupRowContentsReturned=$false
    original178MigrationsReplayed=$false
    managedAuthStorageVaultRestored=$false
    aclParityVerified=$false
    productionDatabaseConnections=0
    releaseAuthorized=$false
  } | ConvertTo-Json -Compress -Depth 5)
}
catch {
  [Console]::Error.WriteLine(('D8K13_LOCAL_BACKUP_DRILL_FAILED: ' + $_.Exception.Message + '. A bare PostgreSQL image may lack Supabase-managed roles/schemas/extensions; treat any failed restore as INCOMPLETE, not as a corrupted backup.'))
  exit 3
}
finally {
  if ($zipReader) { $zipReader.Dispose() }
  if ($containerStarted -and $container) {
    & docker rm --force $container *> $null
  }
  if ($unpacked -and (Test-Path -LiteralPath $unpacked)) {
    Remove-Item -LiteralPath $unpacked -Force -Recurse -ErrorAction SilentlyContinue
  }
}
