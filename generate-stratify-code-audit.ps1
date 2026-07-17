$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Location).Path
$OutputFolder = Join-Path $ProjectRoot "stratify-code-audit"
$DumpFile = Join-Path $OutputFolder "project-code-dump.txt"
$InventoryFile = Join-Path $OutputFolder "project-file-inventory.csv"
$DuplicateFile = Join-Path $OutputFolder "duplicate-code-files.csv"
$TreeFile = Join-Path $OutputFolder "project-tree.txt"
$ZipFile = Join-Path $ProjectRoot "Stratify-Code-Audit.zip"

# Remove previous audit output
if (Test-Path $OutputFolder) {
    Remove-Item $OutputFolder -Recurse -Force
}

if (Test-Path $ZipFile) {
    Remove-Item $ZipFile -Force
}

New-Item -ItemType Directory -Path $OutputFolder | Out-Null

# Folders that must not be included
$ExcludedFolders = @(
    "node_modules",
    ".next",
    ".git",
    ".vercel",
    "dist",
    "build",
    "coverage",
    "out",
    ".turbo",
    ".expo",
    ".idea",
    ".vscode",
    "stratify-code-audit"
)

# Sensitive/generated files that must not be included
$ExcludedFilePatterns = @(
    ".env",
    ".env.*",
    "*.lock",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "*.log",
    "*.map",
    "*.tsbuildinfo",
    "*.pem",
    "*.key",
    "*.crt",
    "*.pfx",
    "*.p12"
)

# Source/config extensions relevant to optimization
$AllowedExtensions = @(
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".json",
    ".css",
    ".scss",
    ".sql",
    ".prisma",
    ".md",
    ".yml",
    ".yaml"
)

function Test-IsExcludedPath {
    param([string]$FullPath)

    $relativePath = $FullPath.Substring($ProjectRoot.Length).TrimStart("\", "/")
    $parts = $relativePath -split "[\\/]+"

    foreach ($folder in $ExcludedFolders) {
        if ($parts -contains $folder) {
            return $true
        }
    }

    return $false
}

function Test-IsExcludedFile {
    param([System.IO.FileInfo]$File)

    foreach ($pattern in $ExcludedFilePatterns) {
        if ($File.Name -like $pattern) {
            return $true
        }
    }

    return $false
}

$Files = Get-ChildItem -Path $ProjectRoot -Recurse -File |
    Where-Object {
        -not (Test-IsExcludedPath $_.FullName) -and
        -not (Test-IsExcludedFile $_) -and
        (
            $AllowedExtensions -contains $_.Extension.ToLowerInvariant() -or
            $_.Name -in @(
                "Dockerfile",
                "Procfile",
                ".gitignore",
                "next.config.ts",
                "next.config.js",
                "middleware.ts",
                "middleware.js"
            )
        )
    } |
    Sort-Object FullName

# Create project tree
"STRATIFY PROJECT TREE" | Set-Content $TreeFile -Encoding UTF8
"Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" |
    Add-Content $TreeFile -Encoding UTF8
"Project: $ProjectRoot" |
    Add-Content $TreeFile -Encoding UTF8
"" | Add-Content $TreeFile -Encoding UTF8

$Files |
    ForEach-Object {
        $_.FullName.Substring($ProjectRoot.Length).TrimStart("\", "/")
    } |
    Add-Content $TreeFile -Encoding UTF8

# Create file inventory
$Inventory = foreach ($File in $Files) {
    $RelativePath = $File.FullName.Substring($ProjectRoot.Length).TrimStart("\", "/")

    try {
        $LineCount = (Get-Content $File.FullName -ErrorAction Stop).Count
    }
    catch {
        $LineCount = 0
    }

    [PSCustomObject]@{
        File          = $RelativePath
        Extension     = $File.Extension
        SizeKB        = [math]::Round($File.Length / 1KB, 2)
        Lines         = $LineCount
        LastModified  = $File.LastWriteTime
    }
}

$Inventory |
    Sort-Object Lines -Descending |
    Export-Csv $InventoryFile -NoTypeInformation -Encoding UTF8

# Create consolidated code dump
@"
================================================================================
STRATIFY PROJECT CODE DUMP
================================================================================
Generated       : $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Project root    : $ProjectRoot
Included files  : $($Files.Count)

Purpose:
- Find unused components, functions, hooks, routes and dependencies
- Detect repeated or duplicated logic
- Identify oversized files
- Improve API/database performance
- Simplify application structure
- Remove dead code safely

Sensitive files such as .env, certificates and keys are excluded.
Generated folders and dependencies are excluded.
================================================================================

"@ | Set-Content $DumpFile -Encoding UTF8

foreach ($File in $Files) {
    $RelativePath = $File.FullName.Substring($ProjectRoot.Length).TrimStart("\", "/")

    @"

================================================================================
FILE: $RelativePath
SIZE: $([math]::Round($File.Length / 1KB, 2)) KB
================================================================================

"@ | Add-Content $DumpFile -Encoding UTF8

    try {
        Get-Content $File.FullName -Raw -ErrorAction Stop |
            Add-Content $DumpFile -Encoding UTF8
    }
    catch {
        "[Unable to read file: $($_.Exception.Message)]" |
            Add-Content $DumpFile -Encoding UTF8
    }

    "`r`n" | Add-Content $DumpFile -Encoding UTF8
}

# Detect completely identical source files
$HashResults = foreach ($File in $Files) {
    try {
        $Hash = Get-FileHash -Path $File.FullName -Algorithm SHA256

        [PSCustomObject]@{
            Hash = $Hash.Hash
            File = $File.FullName.Substring($ProjectRoot.Length).TrimStart("\", "/")
        }
    }
    catch {
        # Ignore unreadable files
    }
}

$Duplicates = $HashResults |
    Group-Object Hash |
    Where-Object Count -gt 1 |
    ForEach-Object {
        $GroupNumber = $_.Name.Substring(0, 12)

        foreach ($Item in $_.Group) {
            [PSCustomObject]@{
                DuplicateGroup = $GroupNumber
                File           = $Item.File
            }
        }
    }

if ($Duplicates) {
    $Duplicates |
        Export-Csv $DuplicateFile -NoTypeInformation -Encoding UTF8
}
else {
    "No completely identical code files detected." |
        Set-Content $DuplicateFile -Encoding UTF8
}

# Add package manifest separately when present
if (Test-Path (Join-Path $ProjectRoot "package.json")) {
    Copy-Item (Join-Path $ProjectRoot "package.json") `
        (Join-Path $OutputFolder "package.json") -Force
}

# Create final ZIP
Compress-Archive `
    -Path "$OutputFolder\*" `
    -DestinationPath $ZipFile `
    -CompressionLevel Optimal `
    -Force

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "STRATIFY CODE AUDIT DUMP CREATED" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host "Files included : $($Files.Count)"
Write-Host "Code dump      : $DumpFile"
Write-Host "Inventory      : $InventoryFile"
Write-Host "Duplicates     : $DuplicateFile"
Write-Host "ZIP package    : $ZipFile"
Write-Host ""
Write-Host "Upload this ZIP file in the chat:" -ForegroundColor Cyan
Write-Host "Stratify-Code-Audit.zip" -ForegroundColor Yellow
