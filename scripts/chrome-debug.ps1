<#
  조종 가능한 크롬 띄우기 (개발용)

  scripts\*.cjs 하네스와 scratchpad\ctl.cjs 가 9222 포트로 붙는다.
  화면이 있는 창이라 직접 눌러 보고 로그인할 수 있다.

  사용법:
      powershell -ExecutionPolicy Bypass -File scripts\chrome-debug.ps1
      powershell -ExecutionPolicy Bypass -File scripts\chrome-debug.ps1 -Url http://localhost:3000/feed
      powershell -ExecutionPolicy Bypass -File scripts\chrome-debug.ps1 -Restart

  ---------------------------------------------------------------------------
  왜 전용 프로필인가

  크롬 136 부터 **기본 프로필로는 --remote-debugging-port 를 쓸 수 없다**
  (보안 조치). 그래서 전용 프로필을 하나 두고 거기서 한 번 로그인해 둔다.

  프로필을 홈 아래(%USERPROFILE%\.chrome-debug-profile)에 두는 게 핵심이다.
  예전에는 세션 스크래치패드 안에 있어서 세션이 바뀔 때마다 로그인이
  통째로 날아갔다 — "세션이 만료되었습니다" 가 그것 때문이었다.

  bat 이 아니라 ps1 인 이유: cmd 는 파일 인코딩을 OEM 코드페이지로 읽어서
  한글 주석이 명령으로 해석돼 깨진다.
#>
param(
  [string]$Url = "http://localhost:3000",
  [int]$Port = 9222,
  # 이미 떠 있는 창을 닫고 새로 띄운다
  [switch]$Restart
)

$ErrorActionPreference = "Stop"

function Test-DebugPort([int]$p) {
  try {
    $r = Invoke-RestMethod "http://127.0.0.1:$p/json/version" -TimeoutSec 2
    return $r.Browser
  } catch {
    return $null
  }
}

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) {
  $chrome = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}
if (-not (Test-Path $chrome)) {
  Write-Host "[!] chrome.exe 를 찾지 못했습니다. 이 파일의 `$chrome 경로를 고쳐 주세요." -ForegroundColor Red
  exit 1
}

$running = Test-DebugPort $Port

if ($running -and $Restart) {
  Write-Host "[-] 기존 창을 닫습니다 ($running)"
  Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
    Where-Object { $_.CommandLine -like "*remote-debugging-port=$Port*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 2
  $running = $null
}

if ($running) {
  # 두 번 띄우면 뒤엣것이 조용히 무시된다(포트 선점). 왜 안 붙는지
  # 한참 헤매게 되므로 여기서 끊는다.
  Write-Host "[=] 이미 떠 있습니다: $running" -ForegroundColor Yellow
  Write-Host "    그 창을 그대로 쓰세요. 새로 띄우려면 -Restart 를 붙이세요."
  exit 0
}

$profileDir = Join-Path $env:USERPROFILE ".chrome-debug-profile"
$isNew = -not (Test-Path $profileDir)

Write-Host "[+] 크롬을 띄웁니다"
Write-Host "    포트     $Port"
Write-Host "    프로필   $profileDir"

Start-Process $chrome -ArgumentList @(
  "--remote-debugging-port=$Port",
  "--user-data-dir=`"$profileDir`"",
  "--no-first-run",
  "--no-default-browser-check",
  $Url
)

# 붙을 수 있게 될 때까지 기다린다. 바로 스크립트를 돌리면 아직 안 뜬다
$browser = $null
foreach ($i in 1..20) {
  Start-Sleep -Milliseconds 500
  $browser = Test-DebugPort $Port
  if ($browser) { break }
}

if (-not $browser) {
  Write-Host "[!] 9222 에 붙지 못했습니다. 창은 떴는지 확인해 주세요." -ForegroundColor Red
  exit 1
}

Write-Host "[+] 준비됨: $browser" -ForegroundColor Green
if ($isNew) {
  Write-Host ""
  Write-Host "    처음 띄운 프로필입니다. 이 창에서 카카오 로그인을 한 번 해 두면" -ForegroundColor Cyan
  Write-Host "    다음부터는 유지됩니다 (프로필이 홈 아래에 남습니다)." -ForegroundColor Cyan
}
Write-Host ""
Write-Host "    확인:  curl http://127.0.0.1:$Port/json/version"
Write-Host "    조종:  node scripts\feed.cjs"
