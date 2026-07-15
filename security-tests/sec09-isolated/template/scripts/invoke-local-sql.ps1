function Get-Sec09DatabaseContainerId {
  param([Parameter(Mandatory = $true)][string]$ProjectId)

  $containers = @(
    docker ps --filter "label=com.supabase.cli.project=$ProjectId" --format '{{.ID}}|{{.Names}}' |
      Where-Object { $_ -match '\|.*supabase_db_' }
  )
  if ($containers.Count -ne 1) {
    throw "Expected exactly one SEC-09 database container; found $($containers.Count)."
  }
  return ($containers[0] -split '\|')[0]
}

function Start-Sec09SqlProcess {
  param(
    [Parameter(Mandatory = $true)][string]$ContainerId,
    [Parameter(Mandatory = $true)][string]$Sql
  )

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = 'docker'
  $startInfo.Arguments = "exec -i $ContainerId psql -X -A -t -q -P pager=off -v ON_ERROR_STOP=1 -U postgres -d postgres"
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  if (-not $process.Start()) {
    throw 'SEC-09 psql process did not start.'
  }
  $process.StandardInput.Write($Sql)
  $process.StandardInput.Close()
  return $process
}

function Complete-Sec09SqlProcess {
  param([Parameter(Mandatory = $true)][System.Diagnostics.Process]$Process)

  $stdoutTask = $Process.StandardOutput.ReadToEndAsync()
  $stderrTask = $Process.StandardError.ReadToEndAsync()
  $Process.WaitForExit()
  return [pscustomobject]@{
    ExitCode = $Process.ExitCode
    Stdout = $stdoutTask.GetAwaiter().GetResult()
    Stderr = $stderrTask.GetAwaiter().GetResult()
  }
}

function Invoke-Sec09Sql {
  param(
    [Parameter(Mandatory = $true)][string]$ContainerId,
    [Parameter(Mandatory = $true)][string]$Sql
  )
  return Complete-Sec09SqlProcess -Process (Start-Sec09SqlProcess -ContainerId $ContainerId -Sql $Sql)
}
