clearclear$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Location).Path
$PackageJson = Join-Path $ProjectRoot "package.json"

if (-not (Test-Path -LiteralPath $PackageJson)) {
    throw "Run this script from the Stratify project root (the folder containing package.json)."
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path (Split-Path $ProjectRoot -Parent) "stratify-cleanup-backup-$Timestamp"

$ConfirmedUnusedFiles = @(
    "app\api\_lib\sources\normalizers.ts",
    "app\api\_lib\sources\worldbank.ts",
    "app\components\DataSourceBanner.tsx",
    "app\corporate-intelligence\_components\CompanyMetricCards.tsx",
    "app\corporate-intelligence\_components\CompanyTable.tsx",
    "app\corporate-intelligence\_components\CorporateDashboard.tsx",
    "app\corporate-intelligence\_components\CorporateMarketSnapshot.tsx",
    "app\corporate-intelligence\_components\SectorBreakdown.tsx",
    "app\corporate-intelligence\_components\TopCompaniesChart.tsx",
    "app\faostat\components\productTableCard.tsx",
    "components\LogoutButton.tsx"
)

New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
$Removed = New-Object System.Collections.Generic.List[string]

try {
    foreach ($RelativePath in $ConfirmedUnusedFiles) {
        $SourcePath = Join-Path $ProjectRoot $RelativePath

        if (-not (Test-Path -LiteralPath $SourcePath)) {
            Write-Host "SKIP (not found): $RelativePath" -ForegroundColor DarkYellow
            continue
        }

        $BackupPath = Join-Path $BackupRoot $RelativePath
        $BackupFolder = Split-Path $BackupPath -Parent
        New-Item -ItemType Directory -Path $BackupFolder -Force | Out-Null

        Copy-Item -LiteralPath $SourcePath -Destination $BackupPath -Force
        Remove-Item -LiteralPath $SourcePath -Force
        $Removed.Add($RelativePath)

        Write-Host "REMOVED: $RelativePath" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "Running production build..." -ForegroundColor Cyan
    & npm run build

    if ($LASTEXITCODE -ne 0) {
        throw "npm run build failed with exit code $LASTEXITCODE"
    }

    Write-Host ""
    Write-Host "Cleanup completed and build passed." -ForegroundColor Green
    Write-Host "Removed files: $($Removed.Count)" -ForegroundColor Green
    Write-Host "Backup: $BackupRoot" -ForegroundColor Cyan
}
catch {
    Write-Host ""
    Write-Host "Cleanup validation failed. Restoring removed files..." -ForegroundColor Red

    foreach ($RelativePath in $Removed) {
        $BackupPath = Join-Path $BackupRoot $RelativePath
        $RestorePath = Join-Path $ProjectRoot $RelativePath
        $RestoreFolder = Split-Path $RestorePath -Parent

        New-Item -ItemType Directory -Path $RestoreFolder -Force | Out-Null
        Copy-Item -LiteralPath $BackupPath -Destination $RestorePath -Force
    }

    Write-Host "Files restored from: $BackupRoot" -ForegroundColor Yellow
    throw
}
