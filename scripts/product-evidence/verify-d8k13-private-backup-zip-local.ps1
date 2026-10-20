# D8K13 owner-side backup ZIP inspection and isolated Supabase/Postgres 17 restore.
# No hosted Supabase connection, network port, bind mount, raw SQL output or GitHub upload.
# Intended for Windows PowerShell 5.1+ / PowerShell 7 with Docker Desktop.
[CmdletBinding()]
param(
  [string] $BackupZip = (Join-Path (Join-Path $HOME 'BEJEWELY_Private_DB_Backups') 'BEJEWELY_DB_Backup_20261018_181006.zip'),
  [ValidateSet('Inspect','Restore','AuditSchema','AuditData')][string] $Mode = 'Inspect',
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
# WinPS 5.1 Start-Process joins ArgumentList; explicitly quote whitespace.
# None of the static restore arguments contain untrusted shell execution syntax.
function Format-DockerArguments([string[]]$items) {
  $parts = foreach ($item in $items) {
    if ($item -match '[\s"]') {
      '"' + $item.Replace('"', '\\"') + '"'
    } else {
      $item
    }
  }
  return ($parts -join ' ')
}
function Run-Docker([string]$stage,[string[]]$arguments) {
  $stdoutLog = Join-Path $unpacked ('docker-' + $stage + '-stdout.log')
  $stderrLog = Join-Path $unpacked ('docker-' + $stage + '-stderr.log')
  $dockerExe = (Get-Command docker -ErrorAction Stop).Source
  $process = Start-Process -FilePath $dockerExe -ArgumentList (Format-DockerArguments $arguments) -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
  $code = [int]$process.ExitCode
  if ($code -ne 0) {
    # Classify failure without exposing SQL, row values, file contents or raw stderr.
    $reason = 'OTHER'
    if (Test-Path -LiteralPath $stderrLog) {
      $details = Get-Content -LiteralPath $stderrLog -Raw -ErrorAction SilentlyContinue
      # With psql VERBOSITY=sqlstate, PostgreSQL prints only SQLSTATE and
      # the originating SQL file/line, never a SQL body or data value.
      # Keep diagnostic output independent of private backup content.
      if ($details -match '(?im)^psql:/tmp/(?:roles|schema|data|d8k13-disposable-auth-baseline)\.sql:([0-9]{1,7}):\s*ERROR:\s*([0-9A-Z]{5})\b') {
        $reason = 'SQLSTATE_' + $Matches[2].ToUpperInvariant() + '_LINE_' + $Matches[1]
      }
      elseif ($details -match '(?im)^\s*ERROR:\s*([0-9A-Z]{5})\b') {
        # psql -c prints SQLSTATE without a source file/line; emit code only.
        $reason = 'SQLSTATE_' + $Matches[1].ToUpperInvariant()
      }
      elseif ($details -match 'role .{0,180} does not exist') { $reason = 'MISSING_ROLE' }
      elseif ($details -match '(?i)schema .{0,180} does not exist') {
        $reason = 'MISSING_SCHEMA'
        # A schema identifier is not an SQL body or row value. Emit ONLY a
        # bounded PostgreSQL identifier from the ERROR line, never the line text.
        if ($details -match '(?im)^psql:/tmp/(?:roles|schema|data|d8k13-disposable-auth-baseline)\.sql:([0-9]{1,7}):\s*ERROR:\s*schema\s+["'']?([a-z_][a-z0-9_]{0,62})["'']?\s+does\s+not\s+exist') {
          $reason = 'MISSING_SCHEMA_' + $Matches[2].ToUpperInvariant() + '_LINE_' + $Matches[1]
        } elseif ($details -match '(?im)^ERROR:\s*schema\s+["'']?([a-z_][a-z0-9_]{0,62})["'']?\s+does\s+not\s+exist') {
          $reason = 'MISSING_SCHEMA_' + $Matches[1].ToUpperInvariant()
        }
      }
      elseif ($details -match 'extension .{0,180} (is not available|does not exist)') { $reason = 'MISSING_EXTENSION' }
      elseif ($details -match 'function .{0,180} does not exist') { $reason = 'MISSING_FUNCTION' }
      elseif ($details -match 'relation .{0,180} does not exist') { $reason = 'MISSING_RELATION' }
      elseif ($details -match 'type .{0,180} does not exist') { $reason = 'MISSING_TYPE' }
      elseif ($details -match 'permission denied') { $reason = 'PERMISSION_DENIED' }
      elseif ($details -match '(already exists|duplicate key)') { $reason = 'ALREADY_EXISTS' }
      elseif ($details -match 'syntax error') { $reason = 'SYNTAX_ERROR' }
    }
    throw ('D8K13_LOCAL_RESTORE_' + $stage + '_' + $reason + '_FAILED_EXIT_' + $code)
  }
}
# Docker pull may print routine status to stderr even on exit 0.
# Start-Process reads the actual exit code, avoiding Windows PowerShell 5.1
# NativeCommandError under ErrorActionPreference=Stop.
function Invoke-DockerLifecycle([string]$stage,[string[]]$arguments,[bool]$allowNonzero = $false) {
  $stdoutLog = Join-Path $unpacked ('docker-lifecycle-' + $stage + '-out.log')
  $stderrLog = Join-Path $unpacked ('docker-lifecycle-' + $stage + '-err.log')
  $binary = (Get-Command docker -ErrorAction Stop).Source
  $process = Start-Process -FilePath $binary -ArgumentList (Format-DockerArguments $arguments) -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
  $exitCode = [int]$process.ExitCode
  if ($exitCode -ne 0 -and -not $allowNonzero) {
    $category = 'FAILED'
    if (Test-Path -LiteralPath $stderrLog) {
      $diagnostic = Get-Content -LiteralPath $stderrLog -Raw -ErrorAction SilentlyContinue
      if ($diagnostic -match '(?i)(manifest unknown|not found|no such image)') { $category = 'IMAGE_UNAVAILABLE' }
      elseif ($diagnostic -match '(?i)(cannot connect to the docker daemon|docker daemon is not running|open //./pipe/docker_engine)') { $category = 'DOCKER_DAEMON_UNAVAILABLE' }
      elseif ($diagnostic -match '(?i)(timeout|TLS handshake|connection refused|no such host|network is unreachable)') { $category = 'NETWORK_UNAVAILABLE' }
      elseif ($diagnostic -match '(?i)(unauthorized|denied|toomanyrequests|rate limit)') { $category = 'REGISTRY_ACCESS_DENIED' }
    }
    throw ('D8K13_LOCAL_DOCKER_' + $stage + '_' + $category + '_EXIT_' + $exitCode)
  }
  return $exitCode
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
  # Official Supabase/Postgres 17 image, local disposable container. No network/ports/volumes.
  $password = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))
  $image = 'supabase/postgres:17.6.1.136'
  $localImageCode = Invoke-DockerLifecycle 'IMAGE_INSPECT' @('image','inspect','--format={{.Id}}',$image) $true
  if ($localImageCode -ne 0) {
    Write-Output 'D8K13_LOCAL_DOCKER_IMAGE_DOWNLOAD_START'
    [void](Invoke-DockerLifecycle 'IMAGE_PULL' @('pull',$image))
    Write-Output 'D8K13_LOCAL_DOCKER_IMAGE_DOWNLOAD_PASS'
  }
  [void](Invoke-DockerLifecycle 'CONTAINER_START' @('run','--detach','--rm',
    '--name',$container,'--network','none','--pids-limit','192',
    '--memory','2g','--cpus','2',
    '-e',('POSTGRES_PASSWORD=' + $password),'-e','POSTGRES_DB=postgres',
    '-e','POSTGRES_HOST=/var/run/postgresql','-e','PGPORT=5432',
    '-e','POSTGRES_PORT=5432','-e',('PGPASSWORD=' + $password),
    '-e',('JWT_SECRET=' + $password),'-e','JWT_EXP=3600',
    $image,'postgres','-c','config_file=/etc/postgresql/postgresql.conf'))
  $containerStarted = $true
  # pg_isready can say "accepting connections" while Supabase image initdb
  # scripts are still setting up auth/storage/extensions/grants.
  # Wait for final bootstrap state, not only socket availability.
  # Require a stable postmaster identity across several checks. Initdb
  # uses a temporary PostgreSQL server before its final restart.
  $readyQuery = "SELECT CASE WHEN (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role','supabase_admin')) = 4 AND to_regclass('auth.users') IS NOT NULL AND EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='storage') AND EXISTS (SELECT 1 FROM pg_extension WHERE extname='supabase_vault') AND EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='extensions') THEN floor(extract(epoch FROM pg_postmaster_start_time()))::bigint::text ELSE '0' END"
  $ready = $false
  $previousPostmaster = ''
  $stableProbes = 0
  for ($i = 0; $i -lt 90; $i++) {
    $readyExit = Invoke-DockerLifecycle 'SUPABASE_BOOTSTRAP_READY' @('exec','-u','postgres',
      $container,'psql','-X','-A','-t','-v','ON_ERROR_STOP=1','-d','postgres',
      '-c',$readyQuery) $true
    $signal = ''
    if ($readyExit -eq 0) {
      $readyText = Get-Content -LiteralPath (Join-Path $unpacked 'docker-lifecycle-SUPABASE_BOOTSTRAP_READY-out.log') -Raw -ErrorAction SilentlyContinue
      if ($readyText) { $signal = $readyText.Trim() }
    }
    if ($signal -match '^[0-9]{10}' -and $signal -eq $previousPostmaster) {
      $stableProbes++
    } else {
      $stableProbes = 0
    }
    $previousPostmaster = $signal
    if ($stableProbes -ge 6) { $ready = $true; break }
    Start-Sleep -Seconds 2
  }
  Assert-Drill $ready 'D8K13_LOCAL_RESTORE_SUPABASE_BOOTSTRAP_NOT_READY'
  $schemaText = [System.IO.File]::ReadAllText((Join-Path $unpacked 'schema.sql'))
  # Supabase CLI may OMIT CREATE SCHEMA public; do not drop default public
  # unless the source dump explicitly recreates it.
  $publicCreation = [regex]::IsMatch($schemaText,
    '(?im)^\s*CREATE\s+SCHEMA\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"public"|public)\s*;')
  $publicCreationConditional = [regex]::IsMatch($schemaText,
    '(?im)^\s*CREATE\s+SCHEMA\s+IF\s+NOT\s+EXISTS\s+(?:"public"|public)\s*;')
  $empty = & docker exec -u postgres $container psql -X -A -t -d postgres -v ON_ERROR_STOP=1 -c "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m','f','S')"
  Assert-Drill ($LASTEXITCODE -eq 0 -and ("$empty".Trim() -eq '0')) 'D8K13_LOCAL_RESTORE_DESTINATION_NOT_EMPTY'
  if ($publicCreation -and -not $publicCreationConditional) {
    Run-Docker 'DROP_EMPTY_PUBLIC' @('exec','-u','postgres',$container,'psql','-X','-q','-v','ON_ERROR_STOP=1','-d','postgres','-c','DROP SCHEMA IF EXISTS public CASCADE')
    Write-Output 'D8K13_LOCAL_PUBLIC_SCHEMA_RECREATED_FROM_DUMP'
  } else {
    Write-Output 'D8K13_LOCAL_PUBLIC_SCHEMA_PRESERVED_FOR_DUMP'
  }
  foreach ($name in $required) {
    Run-Docker ('COPY_' + $name) @('cp',(Join-Path $unpacked $name),($container + ':/tmp/' + $name))
  }
  Run-Docker 'ROLES' @('exec','-u','postgres',$container,'psql','-X','-q','-v','ON_ERROR_STOP=1','--single-transaction','-v','VERBOSITY=sqlstate','-v','SHOW_CONTEXT=never','-d','postgres','-f','/tmp/roles.sql')

  # A Supabase CLI public-schema dump can reference auth.jwt()/auth.uid()
  # without containing these Supabase-managed helper function definitions.
  # This is an isolated restore *test runtime*, not a production migration.
  # Use the definitions from Supabase Auth's upstream SQL migrations, add
  # ONLY missing 0-argument functions, and check the resulting signatures.
  # Do not replace installed managed helpers, weaken RLS, or touch data.
  $usesAuthClaimsHelpers = [regex]::IsMatch($schemaText,
    '(?i)(?:"auth"|auth)\s*\.\s*(?:"jwt"|"uid"|jwt|uid)\s*\(')
  if ($usesAuthClaimsHelpers) {
    # If the source dump defines these helpers, a preseed would hide an
    # incomplete source/runtime contract. Never silently override dump SQL.
    $sourceCreatesHelpers = [regex]::IsMatch($schemaText,
      '(?im)^[ \t]*CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:"auth"|auth)\s*\.\s*(?:"jwt"|"uid"|jwt|uid)\s*\(')
    Assert-Drill (-not $sourceCreatesHelpers) 'D8K13_AUTH_HELPERS_DECLARED_IN_DUMP_UNSUPPORTED'
    $authBaselineSql = @'
DO $d8k13_auth$
BEGIN
  IF to_regnamespace('auth') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '3F000', MESSAGE = 'D8K13_AUTH_MANAGED_SCHEMA_ABSENT';
  END IF;
  IF to_regprocedure('auth.uid()') IS NULL THEN
    EXECUTE $definition$
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
      AS $body$
        SELECT coalesce(
          nullif(current_setting('request.jwt.claim.sub', true), ''),
          (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
        )::uuid
      $body$
    $definition$;
  END IF;
  IF to_regprocedure('auth.jwt()') IS NULL THEN
    EXECUTE $definition$
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE
      AS $body$
        SELECT coalesce(
          nullif(current_setting('request.jwt.claim', true), ''),
          nullif(current_setting('request.jwt.claims', true), '')
        )::jsonb
      $body$
    $definition$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('auth.uid()')
      AND p.prorettype = 'uuid'::regtype AND p.provolatile = 's'
      AND p.prosecdef = false AND p.pronargs = 0
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('auth.jwt()')
      AND p.prorettype = 'jsonb'::regtype AND p.provolatile = 's'
      AND p.prosecdef = false AND p.pronargs = 0
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'D8K13_AUTH_HELPER_SIGNATURE_MISMATCH';
  END IF;
END
$d8k13_auth$;
'@
    $authBaselineFile = Join-Path $unpacked 'd8k13-disposable-auth-baseline.sql'
    [System.IO.File]::WriteAllText($authBaselineFile,$authBaselineSql,[System.Text.UTF8Encoding]::new($false))
    Run-Docker 'COPY_AUTH_BASELINE' @('cp',$authBaselineFile,($container + ':/tmp/d8k13-disposable-auth-baseline.sql'))
    # The image's postgres role is deliberately demoted and can lack CREATE
    # on managed auth; use the image's supabase_admin bootstrap role only here.
    # -U selects the SQL role while -u keeps the same local Unix socket user.
    Run-Docker 'PREPARE_AUTH_BASELINE' @('exec','-u','postgres',$container,'psql',
      '-U','supabase_admin','-X','-q','-v','ON_ERROR_STOP=1','--single-transaction','-v','VERBOSITY=sqlstate',
      '-v','SHOW_CONTEXT=never','-d','postgres','-f','/tmp/d8k13-disposable-auth-baseline.sql')
    Write-Output 'D8K13_LOCAL_DISPOSABLE_AUTH_CLAIMS_HELPERS_VERIFIED'
  }

  # A CLI dump omits Supabase-managed schemas. The official image lacks some
  # custom *empty* namespaces; functions/GRANTs may reference them.
  # Create only a fixed allowlist, only if referenced by the extracted schema,
  # and never if the dump itself has CREATE SCHEMA for the same name.
  # Changes below affect this --network none disposable container exclusively.
  foreach ($schemaName in @('private','recommendation_shadow')) {
    $escapedName = [regex]::Escape($schemaName)
    $declares = [regex]::IsMatch($schemaText, ('(?im)^[ \t]*CREATE\s+SCHEMA\s+(?:IF\s+NOT\s+EXISTS\s+)?"?' + $escapedName + '"?(?=\s|;)'))
    $used = [regex]::IsMatch($schemaText, ('(?i)"?' + $escapedName + '"?\s*\.')) -or
      [regex]::IsMatch($schemaText, ('(?i)\b(?:ON|IN)\s+SCHEMA\s+"?' + $escapedName + '"?\b'))
    if ($used -and -not $declares) {
      Run-Docker ('PREPARE_SCHEMA_' + $schemaName.ToUpperInvariant()) @('exec','-u','postgres',
        $container,'psql','-X','-q','-v','ON_ERROR_STOP=1','-d','postgres',
        '-c',('CREATE SCHEMA IF NOT EXISTS ' + $schemaName))
      Write-Output ('D8K13_LOCAL_ISOLATED_NAMESPACE_READY_' + $schemaName.ToUpperInvariant())
    }
  }
  # This known NOLOGIN role is present in the private backup's roles.sql.
  # PG17 requires the target owner to have CREATE privilege on the function
  # schema and the creator to be allowed to SET ROLE to the target owner.
  # These grants exist ONLY inside the disposable --network none container.
  $ownerRole = 'product_offer_link_health_recorder_owner'
  $rolesText = [System.IO.File]::ReadAllText((Join-Path $unpacked 'roles.sql'))
  $rolePattern = '(?im)^\s*CREATE\s+ROLE\s+"?' + [regex]::Escape($ownerRole) + '"?(?=\s|;)'
  $functionPattern = '(?im)^[ \t]*ALTER\s+FUNCTION\s+(?:"private"|private)\s*\.[^\r\n;]+?\s+OWNER\s+TO\s+"?' + [regex]::Escape($ownerRole) + '"?\s*;'
  $ownerDeclared = [regex]::IsMatch($rolesText, $rolePattern)
  $ownerReferenced = [regex]::IsMatch($schemaText, $functionPattern)
  # Fail closed when the owner assignment exists without a role declaration.
  Assert-Drill (-not $ownerReferenced -or $ownerDeclared) 'D8K13_LOCAL_FUNCTION_OWNER_ROLE_UNDECLARED'
  $grantDeferredIntoSchema = $false
  if ($ownerDeclared -and $ownerReferenced) {
    # Membership can be granted before the dump creates its private schema.
    Run-Docker 'PRIVATE_FUNCTION_OWNER_MEMBERSHIP' @('exec','-u','postgres',$container,'psql','-X','-q','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-v','SHOW_CONTEXT=never','-d','postgres','-c',('GRANT ' + $ownerRole + ' TO postgres'))
    $privateCreatedByDump = [regex]::IsMatch($schemaText,
      '(?im)^[ \t]*CREATE\s+SCHEMA\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"private"|private)(?=\s|;)')
    if ($privateCreatedByDump) {
      # The schema doesn't exist until the dump creates it. Stage the temporary
      # privilege immediately before the exact OWNER TO statement in a LOCAL
      # extracted copy. Keep the original ZIP and ALTER FUNCTION untouched.
      # The staged GRANT stays on the same line to preserve psql line numbers.
      $stagedSchema = [regex]::Replace($schemaText, $functionPattern,
        ('GRANT CREATE ON SCHEMA private TO ' + $ownerRole + '; $&'))
      Assert-Drill ($stagedSchema -ne $schemaText) 'D8K13_LOCAL_FUNCTION_OWNER_GRANT_STAGING_FAILED'
      [System.IO.File]::WriteAllText((Join-Path $unpacked 'schema.sql'),
        $stagedSchema, [System.Text.UTF8Encoding]::new($false))
      Run-Docker 'COPY_STAGED_SCHEMA' @('cp',(Join-Path $unpacked 'schema.sql'),($container + ':/tmp/schema.sql'))
      $grantDeferredIntoSchema = $true
      Write-Output 'D8K13_LOCAL_PRIVATE_FUNCTION_OWNER_GRANT_STAGED_FOR_IN_DUMP_SCHEMA'
    } else {
      # Prepare only the known namespace, within a disposable no-network DB.
      Run-Docker 'PRIVATE_FUNCTION_OWNER_PREPARE_SCHEMA' @('exec','-u','postgres',$container,
        'psql','-X','-q','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-v','SHOW_CONTEXT=never',
        '-d','postgres','-c','CREATE SCHEMA IF NOT EXISTS private')
      Run-Docker 'PRIVATE_FUNCTION_OWNER_SCHEMA_CREATE' @('exec','-u','postgres',$container,
        'psql','-X','-q','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-v','SHOW_CONTEXT=never',
        '-d','postgres','-c',('GRANT CREATE ON SCHEMA private TO ' + $ownerRole))
      Write-Output 'D8K13_LOCAL_PRIVATE_FUNCTION_OWNER_RESTORE_GRANTS_READY'
    }
  } else {
    Write-Output 'D8K13_LOCAL_PRIVATE_FUNCTION_OWNER_RESTORE_GRANTS_NOT_APPLICABLE'
  }
  # Owner ZIP schema.sql includes public ALTER FUNCTION ... OWNER TO statements
  # targeting NOLOGIN roles already declared in its roles.sql. PG17 requires the
  # target to have CREATE on public and the restorer to be a member of it.
  # Stage both requirements for *all matching declared owners in one pass*
  # inside this disposable --network none database, not one failure at a time.
  # The source ZIP remains immutable; any extra ACLs are DRILL-ONLY and never
  # constitute ACL parity evidence.
  $tempSchemaFile = Join-Path $unpacked 'schema.sql'
  $tempSchemaText = [System.IO.File]::ReadAllText($tempSchemaFile)
  $publicFunctionOwnerPattern = '(?im)^[ \t]*ALTER\s+FUNCTION\s+(?:"public"|public)\s*\.[^\r\n;]+?\s+OWNER\s+TO\s+(?<owner>"?[a-z_][a-z0-9_]{0,62}"?)\s*;'
  $publicOwnerChanges = [regex]::Matches($tempSchemaText, $publicFunctionOwnerPattern)
  $roleMembershipReady = @{}
  $preparedPublicOwners = 0
  if ($publicOwnerChanges.Count -gt 0) {
    # Reverse edit order keeps .NET regex offsets stable and psql physical line
    # numbers unchanged. Insert only literal, allowlisted, quoted identifiers.
    for ($k = $publicOwnerChanges.Count - 1; $k -ge 0; $k--) {
      $change = $publicOwnerChanges[$k]
      $roleName = $change.Groups['owner'].Value.Trim('"')
      $declaration = '(?im)^[ \t]*CREATE\s+ROLE\s+"?' + [regex]::Escape($roleName) + '"?(?=\s|;)'
      if (-not [regex]::IsMatch($rolesText, $declaration)) {
        # Unknown or Supabase-managed owners are never granted blindly.
        continue
      }
      Assert-Drill ($roleName -cmatch '^[a-z_][a-z0-9_]{0,62}$') 'D8K13_LOCAL_PUBLIC_FUNCTION_OWNER_UNSAFE_IDENTIFIER'
      if (-not $roleMembershipReady.ContainsKey($roleName)) {
        Run-Docker 'PUBLIC_FUNCTION_OWNER_MEMBERSHIP' @('exec','-u','postgres',
          $container,'psql','-X','-q','-v','ON_ERROR_STOP=1',
          '-v','VERBOSITY=sqlstate','-v','SHOW_CONTEXT=never','-d','postgres',
          '-c',('GRANT ' + $roleName + ' TO postgres'))
        $roleMembershipReady[$roleName] = $true
      }
      $grant = 'GRANT CREATE ON SCHEMA public TO ' + $roleName + '; '
      $tempSchemaText = $tempSchemaText.Insert($change.Index, $grant)
      $preparedPublicOwners++
    }
    if ($preparedPublicOwners -gt 0) {
      [System.IO.File]::WriteAllText($tempSchemaFile, $tempSchemaText,
        [System.Text.UTF8Encoding]::new($false))
      Run-Docker 'COPY_STAGED_PUBLIC_OWNER_SCHEMA' @('cp',$tempSchemaFile,
        ($container + ':/tmp/schema.sql'))
      Write-Output ('D8K13_LOCAL_PUBLIC_FUNCTION_OWNER_GRANTS_STAGED_' + $preparedPublicOwners)
    }
  }
  $tempSchemaText = $null
  $roleMembershipReady = $null
  $rolesText = $null
  $stagedSchema = $null
  $schemaText = $null
  if ($Mode -eq 'AuditSchema') {
    # Diagnostic-only, isolated no-network container; continue past schema errors
    # to enumerate independent failures in one pass. NEVER execute data.sql.
    # Deliberately no single transaction: psql would stay aborted after error 1.
    # A partial schema in the throwaway DB is destroyed by finally().
    $auditExit = Invoke-DockerLifecycle 'SCHEMA_AUDIT' @('exec','-u','postgres',
      $container,'psql','-X','-q','-v','ON_ERROR_STOP=0',
      '-v','VERBOSITY=sqlstate','-v','SHOW_CONTEXT=never',
      '-d','postgres','-f','/tmp/schema.sql') $true
    # A nonzero psql process exit indicates an incomplete audit/transport error,
    # not SQL errors (ON_ERROR_STOP=0 continues after ordinary SQL errors).
    Assert-Drill ([int]$auditExit -eq 0) 'D8K13_SCHEMA_AUDIT_PSQL_EXECUTION_INCOMPLETE'
    $auditStderr = Join-Path $unpacked 'docker-lifecycle-SCHEMA_AUDIT-err.log'
    $auditRaw = ''
    if (Test-Path -LiteralPath $auditStderr) {
      $auditRaw = [System.IO.File]::ReadAllText($auditStderr)
    }
    # Only line numbers and PostgreSQL SQLSTATE are emitted. No exception,
    # object name, source SQL, row content, paths or raw stderr leave this PC.
    $auditRx = [regex]'(?im)^psql:/tmp/schema\.sql:(?<line>[0-9]{1,7}):\s*ERROR:\s*(?<sqlstate>[0-9A-Z]{5})\b'
    $auditMatches = $auditRx.Matches($auditRaw)
    $allSqlstateErrorCount = ([regex]::Matches($auditRaw,'(?im)\bERROR:\s*[0-9A-Z]{5}\b')).Count
    Assert-Drill ($auditMatches.Count -eq $allSqlstateErrorCount) 'D8K13_SCHEMA_AUDIT_UNPARSED_SQLSTATE_FAIL_CLOSED'
    $sqlLines = [System.IO.File]::ReadAllLines($tempSchemaFile)
    $total = $auditMatches.Count
    $entries = New-Object 'System.Collections.Generic.List[object]'
    $counts = @{}
    $limit = [Math]::Min($total,80)
    for ($a = 0; $a -lt $total; $a++) {
      $errorCode = $auditMatches[$a].Groups['sqlstate'].Value.ToUpperInvariant()
      if (-not $counts.ContainsKey($errorCode)) { $counts[$errorCode] = 0 }
      $counts[$errorCode]++
      if ($a -ge $limit) { continue }
      $at = [int]$auditMatches[$a].Groups['line'].Value
      $verb = 'UNKNOWN'
      $objectKind = 'UNKNOWN'
      if ($at -ge 1 -and $at -le $sqlLines.Length) {
        $first = [Math]::Max(0,$at - 121)
        for ($z = $at - 1; $z -ge $first; $z--) {
          $header = $sqlLines[$z]
          if ($header -match '^(ALTER|CREATE|DROP|COMMENT|GRANT|REVOKE|SELECT|DO|SET|RESET)\b') {
            $verb = $Matches[1].ToUpperInvariant()
            if ($header -match '^(?:ALTER|CREATE|DROP|COMMENT\s+ON)\s+(?:OR\s+REPLACE\s+)?(FUNCTION|PROCEDURE|TRIGGER|OPERATOR|TABLE|VIEW|INDEX|EXTENSION|TYPE|SCHEMA|POLICY)\b') {
              $objectKind = $Matches[1].ToUpperInvariant()
            } elseif ($header -match '^(?:GRANT|REVOKE)\b.*\bON\s+(FUNCTION|PROCEDURE|SCHEMA|TABLE|SEQUENCE|TYPE)\b') {
              $objectKind = $Matches[1].ToUpperInvariant()
            }
            break
          }
        }
      }
      $entries.Add([ordered]@{ line=$at; sqlstate=$errorCode; verb=$verb; objectKind=$objectKind })
    }
    $codeCounts = @($counts.Keys | Sort-Object | ForEach-Object {
      [ordered]@{ sqlstate=$_; count=[int]$counts[$_] }
    })
    [ordered]@{
      status='D8K13_DISPOSABLE_PG17_SCHEMA_AUDIT_ONLY_NOT_RESTORE'
      schemaErrorCount=$total
      sampledErrors=$entries.ToArray()
      sampleLimit=80
      errorsTruncated=($total -gt 80)
      sqlstateCounts=$codeCounts
      psqlExitCode=[int]$auditExit
      classificationConfidence='LEXICAL_HEURISTIC_NOT_SQL_PARSER'
      dataSqlExecuted=$false
      originalZipModified=$false
      schemaObjectsNotValidated=$true
      aclParityVerified=$false
      ownerSecurityReviewComplete=$false
      productionDatabaseConnections=0
      rawSqlOrRowsReturned=$false
      networkDisabled=$true
      releaseAuthorized=$false
    } | ConvertTo-Json -Compress -Depth 8 | Write-Output
    return
  }
  Run-Docker 'SCHEMA' @('exec','-u','postgres',$container,'psql','-X','-q','-v','ON_ERROR_STOP=1','--single-transaction','-v','VERBOSITY=sqlstate','-v','SHOW_CONTEXT=never','-d','postgres','-f','/tmp/schema.sql')
  if ($grantDeferredIntoSchema) {
    Write-Output 'D8K13_LOCAL_PRIVATE_FUNCTION_OWNER_RESTORE_GRANTS_READY'
  }
  if ($Mode -eq 'AuditData') {
    # The strict schema restore above must succeed first. Inspect COPY headers,
    # never import rows. Compare every source column with the actual isolated
    # destination catalog in ONE query to avoid line-by-line user roundtrips.
    $dataFile = Join-Path $unpacked 'data.sql'
    $copyHeadPattern = [regex]'(?i)^[ \t]*COPY\s+(?<schema>"?[a-z_][a-z0-9_]{0,62}"?)\s*\.\s*(?<table>"?[a-z_][a-z0-9_]{0,62}"?)\s*\((?<cols>[^)\r\n]{1,16384})\)\s+FROM\s+stdin\s*;[ \t]*$'
    $safeIdent = [regex]'^(?:"[a-z_][a-z0-9_]{0,62}"|[a-z_][a-z0-9_]{0,62})$'
    $copyItems = New-Object 'System.Collections.Generic.List[object]'
    $copyLines = New-Object 'System.Collections.Generic.List[int]'
    $unsupportedCopies = 0
    $physicalLine = 0
    $failedLineCommand = 'UNKNOWN'
    $reader = [System.IO.StreamReader]::new($dataFile,[System.Text.UTF8Encoding]::new($false),$true)
    try {
      $insideCopy = $false
      while (($line = $reader.ReadLine()) -ne $null) {
        $physicalLine++
        if ($physicalLine -eq 28) {
          if ($line -match '^\s*(COPY|INSERT|SELECT|SET|UPDATE|ALTER|DELETE)\b') {
            $failedLineCommand = $Matches[1].ToUpperInvariant()
          } elseif ($insideCopy) { $failedLineCommand = 'COPY_DATA' }
        }
        if ($insideCopy) {
          if ($line -ceq '\.') { $insideCopy = $false }
          continue
        }
        if ($line -match '^\s*COPY\b') {
          $insideCopy = $true
          $m = $copyHeadPattern.Match($line)
          if (-not $m.Success) {
            $unsupportedCopies++
            continue
          }
          $schemaName = $m.Groups['schema'].Value.Trim('"').ToLowerInvariant()
          $tableName = $m.Groups['table'].Value.Trim('"').ToLowerInvariant()
          $cols = @($m.Groups['cols'].Value.Split(',') | ForEach-Object { $_.Trim() })
          if ($cols.Count -eq 0 -or $cols.Count -gt 1000 -or
              (@($cols | Where-Object { -not $safeIdent.IsMatch($_) })).Count -gt 0) {
            $unsupportedCopies++
            continue
          }
          $copyLines.Add($physicalLine)
          foreach ($col in $cols) {
            $copyItems.Add([ordered]@{
              sourceLine=$physicalLine
              sourceSchema=$schemaName
              sourceTable=$tableName
              sourceColumn=$col.Trim('"').ToLowerInvariant()
            })
          }
        }
      }
    } finally { $reader.Dispose() }
    Assert-Drill (-not $insideCopy) 'D8K13_LOCAL_DATA_AUDIT_UNTERMINATED_COPY_FAIL_CLOSED'
    Assert-Drill ($unsupportedCopies -eq 0 -and $copyItems.Count -gt 0 -and
      $copyItems.Count -le 60000) 'D8K13_LOCAL_DATA_AUDIT_UNSUPPORTED_COPY_FAIL_CLOSED'
    # All identifiers below satisfy the lowercase PostgreSQL identifier
    # allowlist; the strings are constructed locally and never printed.
    $rows = @($copyItems | ForEach-Object {
      '(' + $_.sourceLine + ',''' + $_.sourceSchema + ''',''' +
        $_.sourceTable + ''',''' + $_.sourceColumn + ''')'
    })
    $sourceRows = $rows -join (',' + [Environment]::NewLine)
    $catalogQuery = @'
WITH source(line, ns, tbl, col) AS (
 VALUES
__D8K13_SOURCE_ROWS__
), checks AS (
 SELECT s.line, s.ns, s.tbl, s.col,
        EXISTS (
          SELECT 1 FROM pg_namespace n JOIN pg_class c ON c.relnamespace=n.oid
          WHERE n.nspname=s.ns AND c.relname=s.tbl AND c.relkind IN ('r','p','f')
        ) AS table_exists,
        EXISTS (
          SELECT 1 FROM pg_namespace n JOIN pg_class c ON c.relnamespace=n.oid
          JOIN pg_attribute a ON a.attrelid=c.oid
          WHERE n.nspname=s.ns AND c.relname=s.tbl AND c.relkind IN ('r','p','f')
            AND a.attname=s.col AND a.attnum>0 AND NOT a.attisdropped
        ) AS column_exists
 FROM source s
), problems AS (
 SELECT line, ns,
        count(*) FILTER (WHERE NOT table_exists) AS absent_table_columns,
        count(*) FILTER (WHERE table_exists AND NOT column_exists) AS absent_columns
 FROM checks
 WHERE NOT table_exists OR NOT column_exists
 GROUP BY line,ns
)
SELECT json_build_object(
 'totalCopyHeaders',(SELECT count(DISTINCT line) FROM source),
 'totalSourceColumns',(SELECT count(*) FROM source),
 'missingColumns',(SELECT count(*) FROM checks WHERE table_exists AND NOT column_exists),
 'missingTableColumnReferences',(SELECT count(*) FROM checks WHERE NOT table_exists),
 'affectedCopyHeaders',(SELECT count(*) FROM problems),
 'problemSamples',coalesce((SELECT json_agg(json_build_object(
    'line',p.line,
    'schemaClass',CASE WHEN p.ns='public' THEN 'PUBLIC'
       WHEN p.ns IN ('auth','storage','vault','realtime','extensions','supabase_migrations') THEN 'SUPABASE_MANAGED'
       ELSE 'OTHER_SCHEMA' END,
    'absentColumns',p.absent_columns,
    'missingTableColumnReferences',p.absent_table_columns
 ) ORDER BY p.line) FROM (SELECT * FROM problems ORDER BY line LIMIT 60) p),'[]'::json)
)::text
'@
    $catalogQuery = $catalogQuery.Replace('__D8K13_SOURCE_ROWS__',$sourceRows)
    $catalogFile = Join-Path $unpacked 'd8k13-copy-header-contract.sql'
    [System.IO.File]::WriteAllText($catalogFile,$catalogQuery,[System.Text.UTF8Encoding]::new($false))
    Run-Docker 'COPY_DATA_CATALOG_CHECK' @('cp',$catalogFile,($container + ':/tmp/d8k13-copy-header-contract.sql'))
    Run-Docker 'DATA_CATALOG_CHECK' @('exec','-u','postgres',$container,
      'psql','-X','-A','-t','-v','ON_ERROR_STOP=1',
      '-v','VERBOSITY=sqlstate','-v','SHOW_CONTEXT=never',
      '-d','postgres','-f','/tmp/d8k13-copy-header-contract.sql')
    $probeFile = Join-Path $unpacked 'docker-DATA_CATALOG_CHECK-stdout.log'
    $probeText = [System.IO.File]::ReadAllText($probeFile)
    Assert-Drill ($probeText.Trim().StartsWith('{')) 'D8K13_LOCAL_DATA_AUDIT_BAD_CATALOG_RESULT'
    $probe = $probeText.Trim() | ConvertFrom-Json
    [ordered]@{
      status='D8K13_DISPOSABLE_PG17_DATA_COPY_HEADER_AUDIT_ONLY_NOT_RESTORE'
      observedErrorCode='42703'
      reportedDataSqlFailureLine=28
      dataLine28CommandClass=$failedLineCommand
      copyHeaders=[int]$probe.totalCopyHeaders
      sourceCopyColumns=[int]$probe.totalSourceColumns
      missingDestinationColumns=[int]$probe.missingColumns
      missingTableColumnReferences=[int]$probe.missingTableColumnReferences
      affectedCopyHeaders=[int]$probe.affectedCopyHeaders
      problemSamples=@($probe.problemSamples)
      sampleLimit=60
      unparsedCopyHeaders=[int]$unsupportedCopies
      copyDataImported=$false
      strictSchemaRestoreCompleted=$true
      catalogSnapshotIsDisposable=$true
      originalZipModified=$false
      rawSqlOrRowsReturned=$false
      productionDatabaseConnections=0
      releaseAuthorized=$false
    } | ConvertTo-Json -Compress -Depth 7 | Write-Output
    return
  }
  Run-Docker 'DATA' @('exec','-u','postgres',$container,'psql','-X','-q','-v','ON_ERROR_STOP=1','--single-transaction','-v','VERBOSITY=sqlstate','-v','SHOW_CONTEXT=never','-d','postgres','-c','SET session_replication_role = replica','-f','/tmp/data.sql','-c','RESET session_replication_role')
  $inventory = Get-PublicInventory $container
  Assert-Drill ([int]$inventory.pg_major -eq 17) 'D8K13_LOCAL_RESTORE_WRONG_PG_MAJOR'
  Assert-Drill ([int]$inventory.tables -ge 1) 'D8K13_LOCAL_RESTORE_NO_TABLES'
  # Successful SQL application is not proof of Supabase Auth/Storage/Vault/ACL parity.
  Write-Output ([ordered]@{
    status='D8K13_DISPOSABLE_PG17_SQL_RESTORE_PASS_LIMITED'
    inventory=$inventory
    postgresNetworkDisabled=$true
    isolatedRuntime='supabase/postgres:17.6.1.136'
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
  [Console]::Error.WriteLine(('D8K13_LOCAL_BACKUP_DRILL_FAILED: ' + $_.Exception.Message + '. Supabase database image can still lack managed schemas, migrations, or project-specific extensions; restore status is INCOMPLETE, not evidence of backup corruption.'))
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
