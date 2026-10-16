param(
  [string]$VerifyWorktree = 'D:\cha\K-beauty-D8K13-verify',
  [string]$LogPath = ''
)

$ErrorActionPreference = 'Stop'
$PinnedCommit = '3a59bb2bae80c1ac033325ec536f973abb0eabb0'
$RemoteBranch = 'feat/taxonomy-ai/d8k13-legacy-self-review-reconciliation-design-20261016'
$OriginalWorktree = [System.IO.Path]::GetFullPath('D:\cha\K_beauty').TrimEnd('\')
$Root = [System.IO.Path]::GetFullPath($VerifyWorktree).TrimEnd('\')

if ($Root -ieq $OriginalWorktree) {
  throw 'D8K13_SEC05_ORIGINAL_DIRTY_WORKTREE_FORBIDDEN'
}
if (-not (Test-Path -LiteralPath $Root -PathType Container)) {
  throw "D8K13_SEC05_CLEAN_VERIFY_WORKTREE_MISSING: $Root"
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'D8K13_SEC05_GIT_MISSING'
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'D8K13_SEC05_NODE_MISSING'
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'D8K13_SEC05_LOCAL_DOCKER_MISSING'
}

function Assert-NativeSuccess {
  param([string]$CommandName,[string[]]$Arguments)
  & $CommandName @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "D8K13_SEC05_NATIVE_COMMAND_FAILED: $CommandName $($Arguments -join ' ') exit=$LASTEXITCODE"
  }
}

$WorktreeTop = (& git -C $Root rev-parse --show-toplevel)
if ($LASTEXITCODE -ne 0 -or -not $WorktreeTop) {
  throw 'D8K13_SEC05_GIT_VERIFY_WORKTREE_INVALID'
}
$CanonicalTop = [System.IO.Path]::GetFullPath(($WorktreeTop | Select-Object -Last 1)).TrimEnd('\')
if ($CanonicalTop -ine $Root) {
  throw 'D8K13_SEC05_PATH_MUST_BE_WORKTREE_ROOT'
}
$Origin = (& git -C $Root remote get-url origin)
if ($LASTEXITCODE -ne 0 -or $Origin -notmatch '(?i)(?:github\.com[:/])gycha0109-beep/K_beauty(?:\.git)?$') {
  throw 'D8K13_SEC05_GITHUB_REPO_ORIGIN_NOT_TRUSTED'
}
$Dirty = @(& git -C $Root status --porcelain --untracked-files=all)
if ($LASTEXITCODE -ne 0 -or (($Dirty -join '').Trim()).Length -gt 0) {
  throw 'D8K13_SEC05_VERIFY_WORKTREE_MUST_BE_CLEAN'
}

if (-not $LogPath) {
  $LogPath = Join-Path ([System.IO.Path]::GetTempPath()) ("D8K13-sec05-acl-PG17-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
}
$TranscriptStarted = $false
try {
  Start-Transcript -Path $LogPath -Force | Out-Null
  $TranscriptStarted = $true
  Write-Host "D8K13_SEC05_TEST_WORKTREE=$Root"
  Write-Host "D8K13_SEC05_PINNED_COMMIT=$PinnedCommit"
  Write-Host "D8K13_SEC05_NO_HOSTED_DB_OR_DIRTY_ORIGINAL"
  Assert-NativeSuccess git @('-C',$Root,'fetch','--no-tags','origin',$RemoteBranch)
  Assert-NativeSuccess git @('-C',$Root,'cat-file','-e',($PinnedCommit + '^{commit}'))
  Assert-NativeSuccess git @('-C',$Root,'checkout','--detach',$PinnedCommit)
  $ActualHead = (& git -C $Root rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $ActualHead -ne $PinnedCommit) {
    throw 'D8K13_SEC05_CHECKOUT_HEAD_NOT_PINNED'
  }
  Push-Location $Root
  try {
    $Runner = 'scripts/product-evidence/run-d8k13-sec05-acl-synthetic-pg17.mjs'
    Assert-NativeSuccess node @('--check',$Runner)
    Assert-NativeSuccess node @($Runner,'--check-files')
    Assert-NativeSuccess node @($Runner)
    Write-Host 'D8K13_SEC05_ACL_WINDOWS_LOCAL_ACCEPTANCE_PASS'
  }
  finally {
    Pop-Location
  }
}
finally {
  if ($TranscriptStarted) {
    Stop-Transcript | Out-Null
  }
  Write-Host "D8K13_SEC05_ACCEPTANCE_LOG=$LogPath"
}
