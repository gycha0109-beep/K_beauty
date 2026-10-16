# Windows PowerShell 5.1+; operator-private run only, never GitHub Actions.
# No real photo files, keys, or per-case metadata are distributed with this script.
param(
  [Parameter(Mandatory=$true)][string]$Manifest,
  [Parameter(Mandatory=$true)][string]$PhotoDir,
  [Parameter(Mandatory=$true)][string]$ProbeReport,
  [Parameter(Mandatory=$true)][string]$BaselineReport,
  [Parameter(Mandatory=$true)][string]$PrivateOutDir
)
$ErrorActionPreference="Stop"
$root=[System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\.."))
$utf8=New-Object System.Text.UTF8Encoding($false)
function PrivatePath([string]$value,[bool]$isFolder=$false){
  $resolved=[System.IO.Path]::GetFullPath($value)
  if($isFolder){if(!(Test-Path -LiteralPath $resolved -PathType Container)){throw "private_directory_missing"}}
  else{if(!(Test-Path -LiteralPath $resolved -PathType Leaf)){throw "private_file_missing"}}
  if($resolved.StartsWith($root+[System.IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){
    throw "private_input_or_output_in_repository_forbidden"
  }
  return $resolved
}
try{
  $Manifest=PrivatePath $Manifest
  $PhotoDir=PrivatePath $PhotoDir $true
  $ProbeReport=PrivatePath $ProbeReport
  $BaselineReport=PrivatePath $BaselineReport
  $PrivateOutDir=PrivatePath $PrivateOutDir $true
  $stamp=Get-Date -Format "yyyyMMdd_HHmmss"
  $four=Join-Path $PrivateOutDir ("face_lab_s1d_v2_resume4_metadata_"+$stamp+".json")
  $merged=Join-Path $PrivateOutDir ("face_lab_s1d_v2_merged5_metadata_"+$stamp+".json")
  $audit=Join-Path $PrivateOutDir ("face_lab_s1d_v2_comparison_"+$stamp+".json")
  $lock=Join-Path $PrivateOutDir "face_lab_s1d_TC02_TC05_ONCE.attempt-lock"
  Push-Location $root
  try{
    & node scripts/facelab/skin/run-skin-private-v1v2.mjs --validate-private-v2-resume-four --manifest $Manifest --photo-dir $PhotoDir --resume-probe $ProbeReport | Out-Null
    if($LASTEXITCODE -ne 0){throw "private_resume_preflight_failed"}
    if(Test-Path -LiteralPath $lock){throw "four_call_attempt_already_recorded_do_not_retry"}
    Write-Host "TC-01 reuse verified. Exactly TC-02..05: up to FOUR billable KEY2 calls; zero v1/TC-01; no retry."
    $ok=Read-Host "Type YES4 to authorize this one four-call attempt"
    if($ok -cne "YES4"){throw "operator_did_not_authorize"}
    $sec=Read-Host "Enter OPENAI_API_KEY2 locally" -AsSecureString
    $ptr=[IntPtr]::Zero
    try{
      $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
      $env:OPENAI_API_KEY2=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
      if([string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY2)){throw "empty_key2"}
      $rows=@(& node scripts/facelab/skin/run-skin-private-v1v2.mjs --live-private-v2-resume-four --manifest $Manifest --photo-dir $PhotoDir --resume-probe $ProbeReport --attempt-lock $lock)
      $exit=$LASTEXITCODE
    }finally{
      Remove-Item Env:\OPENAI_API_KEY2 -ErrorAction SilentlyContinue
      if($ptr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
    }
    if($rows.Count -gt 0){[System.IO.File]::WriteAllText($four,($rows -join "`n"),$utf8)}
    if($exit -ne 0){throw "provider_attempt_held_no_automatic_retry_private_metadata_kept"}
    & node scripts/facelab/skin/merge-skin-private-v2-resume.mjs $ProbeReport $four $merged | Out-Null
    if($LASTEXITCODE -ne 0){throw "five_case_private_metadata_merge_held"}
    $comparison=@(& node scripts/facelab/skin/compare-skin-private-v2-correction.mjs $BaselineReport $merged)
    if($LASTEXITCODE -ne 0){throw "historical_structural_audit_held"}
    [System.IO.File]::WriteAllText($audit,($comparison -join "`n"),$utf8)
    Write-Host "PRIVATE_RESEARCH_METADATA_COMPLETE. Local files generated in the private output directory."
    Write-Host "Research-only. Human accuracy, Face-value parity, scoring and release remain HOLD."
  }finally{Pop-Location}
}catch{
  # Never print exceptions: they can contain paths, secrets or terminal data.
  Write-Error "PRIVATE_V2_RESUME_STOPPED: inspect private local status and lock; do not rerun automatically."
  exit 1
}
