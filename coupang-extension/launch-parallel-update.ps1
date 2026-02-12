<#
.SYNOPSIS
    Launches multiple Edge browser instances with unique fingerprint profiles
    for parallel coupang tracking workers.

.DESCRIPTION
    Each worker gets a separate Edge profile with distinct:
    - User-Agent (different Edge versions)
    - Window size and scale factor
    - Language settings
    - Font size preferences
    - Screen position (side by side)

.PARAMETER Setup
    Opens Edge profiles to edge://extensions for Tampermonkey installation.

.PARAMETER Workers
    Number of parallel workers to launch (1-5, default 3).

.EXAMPLE
    .\launch-parallel-update.ps1 -Setup
    .\launch-parallel-update.ps1 -Workers 4
#>

param(
    [switch]$Setup,
    [ValidateRange(1, 5)]
    [int]$Workers = 3
)

$ErrorActionPreference = "Stop"

# --- Constants ---
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProfileBaseDir = Join-Path $ScriptDir "edge-profiles"
$EdgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

if (-not (Test-Path $EdgePath)) {
    $EdgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

if (-not (Test-Path $EdgePath)) {
    Write-Host "[ERROR] Microsoft Edge not found. Please install Edge or update the path." -ForegroundColor Red
    exit 1
}

# --- Fingerprint Profiles ---
# Each profile simulates a different user persona with unique browser fingerprint
$Profiles = @(
    @{
        Index       = 0
        Name        = "Worker-A"
        UserAgent   = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.86"
        WindowSize  = "1920,1080"
        ScaleFactor = "1.0"
        Lang        = "ko-KR"
        AcceptLang  = "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
        FontSize    = 16
    },
    @{
        Index       = 1
        Name        = "Worker-B"
        UserAgent   = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.86"
        WindowSize  = "1920,1080"
        ScaleFactor = "1.0"
        Lang        = "ko-KR"
        AcceptLang  = "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
        FontSize    = 16
    },
    @{
        Index       = 2
        Name        = "Worker-C"
        UserAgent   = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.86"
        WindowSize  = "1920,1080"
        ScaleFactor = "1.0"
        Lang        = "ko-KR"
        AcceptLang  = "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
        FontSize    = 16
    },
    @{
        Index       = 3
        Name        = "Worker-D"
        UserAgent   = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.86"
        WindowSize  = "1920,1080"
        ScaleFactor = "1.0"
        Lang        = "ko-KR"
        AcceptLang  = "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
        FontSize    = 16
    },
    @{
        Index       = 4
        Name        = "Worker-E"
        UserAgent   = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.86"
        WindowSize  = "1920,1080"
        ScaleFactor = "1.0"
        Lang        = "ko-KR"
        AcceptLang  = "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
        FontSize    = 16
    }
)

# --- Helper: Create profile preferences ---
function New-ProfilePreferences {
    param(
        [hashtable]$Profile
    )

    $profileDir = Join-Path $ProfileBaseDir "worker-$($Profile.Index)"
    $defaultDir = Join-Path $profileDir "Default"
    $prefsPath  = Join-Path $defaultDir "Preferences"

    if (-not (Test-Path $defaultDir)) {
        New-Item -ItemType Directory -Path $defaultDir -Force | Out-Null
    }

    $prefs = @{
        webkit = @{
            webprefs = @{
                default_font_size        = $Profile.FontSize
                default_fixed_font_size  = ($Profile.FontSize - 3)
                minimum_font_size        = [Math]::Max(8, $Profile.FontSize - 4)
            }
        }
        intl = @{
            accept_languages = $Profile.AcceptLang
        }
        profile = @{
            default_content_setting_values = @{
                notifications = 2  # Block notifications
            }
        }
        browser = @{
            enabled_labs_experiments = @()
        }
    }

    $prefsJson = $prefs | ConvertTo-Json -Depth 10
    Set-Content -Path $prefsPath -Value $prefsJson -Encoding UTF8
    Write-Host "  [OK] Preferences written for worker-$($Profile.Index)" -ForegroundColor DarkGray
}

# --- Helper: Check Tampermonkey ---
function Test-TampermonkeyInstalled {
    param([int]$WorkerIndex)

    $extDir = Join-Path (Join-Path (Join-Path $ProfileBaseDir "worker-$WorkerIndex") "Default") "Extensions"
    return (Test-Path $extDir)
}

# --- Setup Mode ---
if ($Setup) {
    Write-Host ""
    Write-Host "=== SETUP MODE: Installing Tampermonkey ===" -ForegroundColor Cyan
    Write-Host "Each Edge profile will open to edge://extensions." -ForegroundColor Cyan
    Write-Host "Install Tampermonkey in each window, then close all windows." -ForegroundColor Cyan
    Write-Host ""

    for ($i = 0; $i -lt $Workers; $i++) {
        $profile = $Profiles[$i]
        $profileDir = Join-Path $ProfileBaseDir "worker-$i"

        # Create preferences
        New-ProfilePreferences -Profile $profile

        Write-Host "Opening Worker $i ($($profile.Name)) for extension setup..." -ForegroundColor Yellow

        $args = @(
            "--user-data-dir=`"$profileDir`""
            "--no-first-run"
            "--lang=$($profile.Lang)"
            "edge://extensions"
        )

        Start-Process -FilePath $EdgePath -ArgumentList $args
        Start-Sleep -Seconds 2
    }

    Write-Host ""
    Write-Host "=== All $Workers profile windows opened ===" -ForegroundColor Green
    Write-Host "1. Install Tampermonkey from Edge Add-ons in each window" -ForegroundColor White
    Write-Host "2. Install the coupang-tracker.user.js script in Tampermonkey" -ForegroundColor White
    Write-Host "3. Close all Edge windows when done" -ForegroundColor White
    Write-Host "4. Run this script again without -Setup to start workers" -ForegroundColor White
    Write-Host ""
    exit 0
}

# --- Run Mode ---
Write-Host ""
Write-Host "=== Coupang Parallel Worker Launcher ===" -ForegroundColor Cyan
Write-Host "Workers: $Workers | Profiles: Unique fingerprints per worker" -ForegroundColor Cyan
Write-Host ""

# Pre-flight: create profiles and check Tampermonkey
$warnings = @()
for ($i = 0; $i -lt $Workers; $i++) {
    $profile = $Profiles[$i]
    New-ProfilePreferences -Profile $profile

    if (-not (Test-TampermonkeyInstalled -WorkerIndex $i)) {
        $warnings += "Worker $i ($($profile.Name)): Extensions directory not found. Run -Setup first."
    }
}

if ($warnings.Count -gt 0) {
    Write-Host ""
    Write-Host "[WARNING] Tampermonkey may not be installed:" -ForegroundColor Yellow
    foreach ($w in $warnings) {
        Write-Host "  - $w" -ForegroundColor Yellow
    }
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "Aborted." -ForegroundColor Red
        exit 0
    }
    Write-Host ""
}

# Calculate window positions (side by side)
$screenWidth = 1920
$windowWidth = [Math]::Floor($screenWidth / $Workers)

# Launch workers with staggered timing
for ($i = 0; $i -lt $Workers; $i++) {
    $profile = $Profiles[$i]
    $profileDir = Join-Path $ProfileBaseDir "worker-$i"
    $xPos = $i * $windowWidth
    $yPos = 0
    $url = "http://localhost:3000/coupang?worker=$i&total=$Workers"

    # Parse window dimensions from profile
    $dims = $profile.WindowSize -split ","
    $wWidth = [Math]::Min([int]$dims[0], $windowWidth)
    $wHeight = [int]$dims[1]

    Write-Host "Launching Worker $i ($($profile.Name))..." -ForegroundColor Green
    Write-Host "  UA: ...Edg/$($profile.UserAgent -replace '.*Edg/', '')" -ForegroundColor DarkGray
    Write-Host "  Window: ${wWidth}x${wHeight} at ($xPos, $yPos)" -ForegroundColor DarkGray
    Write-Host "  Scale: $($profile.ScaleFactor) | Lang: $($profile.Lang) | Font: $($profile.FontSize)px" -ForegroundColor DarkGray

    # 확장 프로그램 자동 로딩 (Tampermonkey 불필요)
    $extensionDir = $ScriptDir -replace '\\', '/'

    $edgeArgs = @(
        "--user-data-dir=`"$profileDir`""
        "--user-agent=`"$($profile.UserAgent)`""
        "--lang=$($profile.Lang)"
        "--force-device-scale-factor=$($profile.ScaleFactor)"
        "--window-size=$wWidth,$wHeight"
        "--window-position=$xPos,$yPos"
        "--no-first-run"
        "--disable-background-networking"
        "--disable-sync"
        "--disable-extensions-except=`"$extensionDir`""
        "--load-extension=`"$extensionDir`""
        $url
    )

    Start-Process -FilePath $EdgePath -ArgumentList $edgeArgs

    # Anti-bot: random stagger between 5-10 seconds
    if ($i -lt ($Workers - 1)) {
        $delay = Get-Random -Minimum 5 -Maximum 11
        Write-Host "  Waiting ${delay}s before next worker..." -ForegroundColor DarkGray
        Start-Sleep -Seconds $delay
    }
}

# --- Fingerprint Summary ---
Write-Host ""
Write-Host "=== Fingerprint Summary ===" -ForegroundColor Cyan
Write-Host ("-" * 90) -ForegroundColor DarkGray
Write-Host ("{0,-8} {1,-15} {2,-10} {3,-12} {4,-7} {5,-7} {6,-8}" -f "Worker", "Persona", "Edge Ver", "Resolution", "Scale", "Lang", "Font") -ForegroundColor White
Write-Host ("-" * 90) -ForegroundColor DarkGray

for ($i = 0; $i -lt $Workers; $i++) {
    $p = $Profiles[$i]
    $edgeVer = $p.UserAgent -replace '.*Edg/', 'Edg/'
    $edgeVer = $edgeVer.Substring(0, [Math]::Min($edgeVer.Length, 9))
    Write-Host ("{0,-8} {1,-15} {2,-10} {3,-12} {4,-7} {5,-7} {6,-8}" -f `
        "[$i]", $p.Name, $edgeVer, $p.WindowSize, $p.ScaleFactor, $p.Lang, "$($p.FontSize)px") -ForegroundColor White
}

Write-Host ("-" * 90) -ForegroundColor DarkGray
Write-Host ""
Write-Host "All $Workers workers launched successfully." -ForegroundColor Green
Write-Host "Target: http://localhost:3000/coupang" -ForegroundColor White
Write-Host ""
