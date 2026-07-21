#Requires -Version 7.0
<#
    FrameFlow — WINDOWS CI ISBOTI: haqiqiy per-user `.msi` o'rnatiladi, tarkibi tekshiriladi
    va o'chiriladi. Bu skript FAQAT bir martalik (ephemeral) GitHub Actions runner'ida ishlaydi.

    Nima isbotlanadi (hammasi fail-closed — har nomuvofiqlik = throw):
      1. O'rnatishdan OLDIN nishon papkaga AYNAN `obsoleteInstallFiles()` (MSI'dan oldingi
         qo'lda/`.zxp` o'rnatmaning qoldiqlari) + alohida `assetflow-data` sentinel qo'yiladi.
      2. `msiexec /i /qn` jimgina o'rnatadi va chiqish kodi AYNAN 0 bo'lishi shart.
      3. O'rnatilgan fayl ro'yxati manba payload'i bilan AYNAN teng va HAR fayl SHA-256 bo'yicha
         bayt-ba-bayt bir xil; eski qoldiqlarning HAMMASI o'chgan; sentinel TEGILMAGAN.
      4. `msiexec /x /qn` jimgina o'chiradi: MSI o'z payload'ini olib tashlaydi, sentinel QOLADI.
      5. `finally` — har qanday nosozlikda ham: MSI ro'yxatdan olinadi va FAQAT tekshirилган
         per-user nishon papkasi tozalanadi.

    Ro'yxatlar HECH QAYERDA takrorlanmaydi — hammasi mavjud yagona manbadan (CLI orqali):
      node package-flavors.mjs field customer installDirName
      node installer-payload.mjs payload-files | stale-files | stage <dir>
      node installer-wix.mjs cleanup-registry

    Sertifikat/imzo/sir YO'Q: bu yo'l faqat IMZOLANMAGAN QA MSI bilan ishlaydi.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $MsiPath,
    [Parameter(Mandatory = $true)][string] $WorkDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

# ── Qat'iy muhit qorovuli ───────────────────────────────────────────────────
# Skript per-user CEP papkasini o'chiradi → ishlab turgan mashinada HECH QACHON ishlamasin.
if ($env:GITHUB_ACTIONS -ne 'true') {
    throw "Bu skript FAQAT ephemeral GitHub Actions runner'ida ishlaydi (GITHUB_ACTIONS=true topilmadi)."
}
if ([string]::IsNullOrWhiteSpace($env:APPDATA) -or [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
    throw "APPDATA/USERPROFILE aniqlanmadi — nishon yo'lini xavfsiz qurib bo'lmaydi."
}
if ([string]::IsNullOrWhiteSpace($env:RUNNER_TEMP)) {
    throw "RUNNER_TEMP aniqlanmadi — ish papkasi runner temp ichida bo'lishi SHART."
}

$RepoRoot   = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$FlavorsCli = Join-Path $RepoRoot 'plugins\after-effects-cep\scripts\package-flavors.mjs'
$PayloadCli = Join-Path $RepoRoot 'plugins\after-effects-cep\scripts\installer-payload.mjs'
$WixCli     = Join-Path $RepoRoot 'plugins\after-effects-cep\scripts\installer-wix.mjs'
foreach ($cli in @($FlavorsCli, $PayloadCli, $WixCli)) {
    if (-not (Test-Path -LiteralPath $cli -PathType Leaf)) { throw "Manba CLI topilmadi: $cli" }
}

function Invoke-NodeLines {
    param([Parameter(Mandatory = $true)][string[]] $NodeArgs)
    $out = & node @NodeArgs
    if ($LASTEXITCODE -ne 0) { throw "node $($NodeArgs -join ' ') → exit $LASTEXITCODE" }
    return @($out | ForEach-Object { "$_".Trim() } | Where-Object { $_ -ne '' })
}

function Get-RelativeFiles {
    param([Parameter(Mandatory = $true)][string] $Root)
    $full = [IO.Path]::GetFullPath($Root)
    if (-not (Test-Path -LiteralPath $full -PathType Container)) { return @() }
    return @(
        Get-ChildItem -LiteralPath $full -Recurse -File -Force |
            ForEach-Object { $_.FullName.Substring($full.Length + 1).Replace('\', '/') } |
            Sort-Object
    )
}

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string] $Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}

function Join-Rel {
    param(
        [Parameter(Mandatory = $true)][string] $Root,
        [Parameter(Mandatory = $true)][string] $Rel
    )
    if ($Rel -notmatch '^[A-Za-z0-9._][A-Za-z0-9._/-]*$') { throw "Nisbiy yo'l shakli noto'g'ri: $Rel" }
    if (@($Rel -split '/') -contains '..') { throw "Nisbiy yo'lda traversal: $Rel" }
    $rootFull = [IO.Path]::GetFullPath($Root)
    $abs = [IO.Path]::GetFullPath((Join-Path $rootFull ($Rel -replace '/', '\')))
    if (-not $abs.StartsWith($rootFull + [IO.Path]::DirectorySeparatorChar, 'OrdinalIgnoreCase')) {
        throw "Yo'l nishon papkadan chiqib ketdi: $Rel"
    }
    return $abs
}

function Assert-SetsEqual {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][string[]] $Actual,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][string[]] $Expected,
        [Parameter(Mandatory = $true)][string] $What
    )
    $extra   = @($Actual   | Where-Object { $Expected -notcontains $_ })
    $missing = @($Expected | Where-Object { $Actual   -notcontains $_ })
    if ($extra.Count -or $missing.Count) {
        throw "$What mos emas — ortiqcha=[$($extra -join ', ')] yetishmayapti=[$($missing -join ', ')]"
    }
}

# ── Kontrakt (yagona manba) ─────────────────────────────────────────────────
$installDirName = (Invoke-NodeLines @($FlavorsCli, 'field', 'customer', 'installDirName'))[0]
$legacyFiles    = Invoke-NodeLines @($PayloadCli, 'stale-files')
$contractFiles  = Invoke-NodeLines @($PayloadCli, 'payload-files')
$cleanupReg     = (Invoke-NodeLines @($WixCli, 'cleanup-registry'))[0] -split "`t"
if ($cleanupReg.Count -ne 2) { throw "cleanup-registry kontrakti kutilmagan shaklda: $($cleanupReg -join '|')" }
$cleanupRegKey  = "HKCU:\$($cleanupReg[0])"
$cleanupRegName = $cleanupReg[1]

if ($legacyFiles.Count -lt 1)   { throw "Eski fayllar ro'yxati bo'sh — migratsiyani sinab bo'lmaydi." }
if ($contractFiles.Count -lt 1) { throw "Payload kontrakti bo'sh." }
foreach ($rel in $legacyFiles) {
    if ($contractFiles -contains $rel) { throw "Eski fayl joriy payload bilan kesishdi: $rel" }
}

# ── Nishon papka: AYNAN bitta per-user yo'l, qattiq tekshiruv ───────────────
if ($installDirName -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$') {
    throw "installDirName shakli kutilmagan: $installDirName"
}
$profileRoot    = [IO.Path]::GetFullPath($env:USERPROFILE)
$extensionsRoot = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'Adobe\CEP\extensions'))
$target         = [IO.Path]::GetFullPath((Join-Path $extensionsRoot $installDirName))
if ($target -ne (Join-Path $extensionsRoot $installDirName)) { throw "Nishon yo'li normallashmadi: $target" }
if (-not $target.StartsWith($profileRoot + [IO.Path]::DirectorySeparatorChar, 'OrdinalIgnoreCase')) {
    throw "Nishon foydalanuvchi profilidan tashqarida: $target"
}
if (-not $target.EndsWith("\Adobe\CEP\extensions\$installDirName", 'OrdinalIgnoreCase')) {
    throw "Nishon kutilgan per-user CEP yo'li emas: $target"
}
if (@($target -split '\\').Count -lt 6) { throw "Nishon yo'li juda sayoz: $target" }
if (Test-Path -LiteralPath $target) {
    throw "Nishon papka allaqachon mavjud — ephemeral runner'da bo'lmasligi kerak: $target"
}

$workFull = [IO.Path]::GetFullPath($WorkDir)
$tempRoot = [IO.Path]::GetFullPath($env:RUNNER_TEMP)
if (-not $workFull.StartsWith($tempRoot + [IO.Path]::DirectorySeparatorChar, 'OrdinalIgnoreCase')) {
    throw "Ish papkasi RUNNER_TEMP ichida bo'lishi SHART: $workFull"
}
if (-not (Test-Path -LiteralPath $MsiPath -PathType Leaf)) { throw "MSI topilmadi: $MsiPath" }
$msiFull = [IO.Path]::GetFullPath($MsiPath)

$targetValidated = $true
$stageDir = Join-Path $workFull 'payload'
$logDir   = Join-Path $workFull 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

Write-Host "→ FrameFlow Windows CI o'rnatish isboti"
Write-Host "  MSI     : $msiFull"
Write-Host "  Nishon  : $target"
Write-Host "  Eski    : $($legacyFiles -join ', ')"

try {
    # ── 0) Manba payload'ini alohida yig'amiz (bayt taqqoslash uchun) ───────
    Invoke-NodeLines @($PayloadCli, 'stage', $stageDir) | Out-Null
    $stagedFiles = Get-RelativeFiles $stageDir
    Assert-SetsEqual -Actual $stagedFiles -Expected $contractFiles -What "Yig'ilgan payload kontrakti"
    Write-Host "  Payload : $($stagedFiles.Count) fayl (manbadan yig'ildi)"

    # ── 1) MSI'dan OLDINGI o'rnatma qoldiqlarini "ekamiz" (AYNAN kontrakt ro'yxati) ──
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    foreach ($rel in $legacyFiles) {
        $abs = Join-Rel -Root $target -Rel $rel
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $abs) | Out-Null
        Set-Content -LiteralPath $abs -Value "FF-CI-LEGACY-LEFTOVER $rel" -NoNewline -Encoding ascii
    }
    # Foydalanuvchi ma'lumoti — MSI komponenti EMAS, hech qachon tegilmasligi kerak.
    $sentinelRel  = 'assetflow-data/ci-user-data-sentinel.txt'
    $sentinelAbs  = Join-Rel -Root $target -Rel $sentinelRel
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $sentinelAbs) | Out-Null
    Set-Content -LiteralPath $sentinelAbs -Value 'FF-CI-USER-DATA-SENTINEL' -NoNewline -Encoding ascii
    $sentinelSha = Get-Sha256 $sentinelAbs

    $seeded = Get-RelativeFiles $target
    Assert-SetsEqual -Actual $seeded -Expected (@($legacyFiles) + @($sentinelRel)) -What 'Ekilgan qoldiq holati'
    Write-Host "  Ekildi  : $($seeded.Count) fayl (eski qoldiq + sentinel)"

    # ── 2) JIMGINA per-user o'rnatish ──────────────────────────────────────
    $installLog = Join-Path $logDir 'msiexec-install.log'
    $install = Start-Process -FilePath 'msiexec.exe' -Wait -PassThru -ArgumentList @(
        '/i', "`"$msiFull`"", '/qn', '/norestart', '/l*v', "`"$installLog`""
    )
    if ($install.ExitCode -ne 0) {
        if (Test-Path -LiteralPath $installLog) { Get-Content -LiteralPath $installLog -Tail 60 | Write-Host }
        throw "msiexec /i FAIL-CLOSED — exit=$($install.ExitCode) (kutilgan aynan 0)"
    }
    Write-Host "  O'rnatildi (msiexec /i /qn → exit 0)"

    # ── 3) O'rnatma tarkibi ────────────────────────────────────────────────
    $installedAll   = Get-RelativeFiles $target
    $installedOwned = @($installedAll | Where-Object { -not $_.StartsWith('assetflow-data/') })
    Assert-SetsEqual -Actual $installedOwned -Expected $stagedFiles -What "O'rnatilgan fayl ro'yxati"

    foreach ($rel in $stagedFiles) {
        $src = Join-Rel -Root $stageDir -Rel $rel
        $dst = Join-Rel -Root $target   -Rel $rel
        if (-not (Test-Path -LiteralPath $dst -PathType Leaf)) { throw "O'rnatilmagan fayl: $rel" }
        $a = Get-Sha256 $src
        $b = Get-Sha256 $dst
        if ($a -ne $b) { throw "Bayt nomuvofiqligi (SHA-256): $rel  manba=$a o'rnatma=$b" }
    }
    Write-Host "  Tarkib  : $($stagedFiles.Count)/$($stagedFiles.Count) fayl bayt-ba-bayt mos"

    foreach ($rel in $legacyFiles) {
        $abs = Join-Rel -Root $target -Rel $rel
        if (Test-Path -LiteralPath $abs) { throw "MIGRATSIYA YIQILDI — eski fayl o'rnatmadan keyin ham qoldi: $rel" }
    }
    Write-Host "  Migratsiya: $($legacyFiles.Count)/$($legacyFiles.Count) eski qoldiq o'chirildi"

    if (-not (Test-Path -LiteralPath $sentinelAbs -PathType Leaf)) {
        throw "O'rnatma foydalanuvchi ma'lumotini o'chirdi: $sentinelRel"
    }
    if ((Get-Sha256 $sentinelAbs) -ne $sentinelSha) { throw "Sentinel baytlari o'zgardi: $sentinelRel" }

    # Migratsiya komponenti HAQIQATAN o'rnatildi (per-user HKCU keypath).
    $regAfterInstall = Get-ItemProperty -Path $cleanupRegKey -Name $cleanupRegName -ErrorAction SilentlyContinue
    if ($null -eq $regAfterInstall) {
        throw "Migratsiya komponenti keypath'i topilmadi: $cleanupRegKey\$cleanupRegName"
    }

    # Per-user isboti: tizim papkasiga hech narsa yozilmagan.
    foreach ($sys in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if ([string]::IsNullOrWhiteSpace($sys)) { continue }
        $stray = Join-Path $sys 'FrameFlow'
        if (Test-Path -LiteralPath $stray) { throw "Per-user shart buzildi — tizim papkasiga yozildi: $stray" }
    }

    # ── 4) JIMGINA o'chirish ───────────────────────────────────────────────
    $uninstallLog = Join-Path $logDir 'msiexec-uninstall.log'
    $uninstall = Start-Process -FilePath 'msiexec.exe' -Wait -PassThru -ArgumentList @(
        '/x', "`"$msiFull`"", '/qn', '/norestart', '/l*v', "`"$uninstallLog`""
    )
    if ($uninstall.ExitCode -ne 0) {
        if (Test-Path -LiteralPath $uninstallLog) { Get-Content -LiteralPath $uninstallLog -Tail 60 | Write-Host }
        throw "msiexec /x FAIL-CLOSED — exit=$($uninstall.ExitCode) (kutilgan aynan 0)"
    }
    Write-Host "  O'chirildi (msiexec /x /qn → exit 0)"

    $afterAll   = Get-RelativeFiles $target
    $afterOwned = @($afterAll | Where-Object { -not $_.StartsWith('assetflow-data/') })
    if ($afterOwned.Count -ne 0) {
        throw "O'chirishdan keyin MSI payload qoldig'i: [$($afterOwned -join ', ')]"
    }
    if (-not (Test-Path -LiteralPath $sentinelAbs -PathType Leaf)) {
        throw "O'chirish foydalanuvchi ma'lumotini o'chirdi: $sentinelRel"
    }
    if ((Get-Sha256 $sentinelAbs) -ne $sentinelSha) { throw "O'chirishdan keyin sentinel baytlari o'zgardi." }

    $regAfterUninstall = Get-ItemProperty -Path $cleanupRegKey -Name $cleanupRegName -ErrorAction SilentlyContinue
    if ($null -ne $regAfterUninstall) {
        throw "O'chirishdan keyin migratsiya keypath'i qoldi: $cleanupRegKey\$cleanupRegName"
    }

    Write-Host "✓ Windows per-user MSI isboti TO'LIQ o'tdi (o'rnatish · migratsiya · o'chirish · sentinel)"
}
finally {
    # Har qanday holatda: MSI ro'yxatdan olinadi va FAQAT tekshirilgan per-user nishon tozalanadi.
    try {
        if (Test-Path -LiteralPath $msiFull -PathType Leaf) {
            Start-Process -FilePath 'msiexec.exe' -Wait -PassThru -ArgumentList @(
                '/x', "`"$msiFull`"", '/qn', '/norestart'
            ) | Out-Null
        }
    }
    catch { Write-Host "  ⓘ tozalash: msiexec /x o'tmadi (e'tiborsiz)" }

    try {
        if ($targetValidated -and (Test-Path -LiteralPath $target -PathType Container)) {
            Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    catch { Write-Host "  ⓘ tozalash: nishon papka o'chmadi (e'tiborsiz)" }

    try {
        if (Test-Path -LiteralPath $workFull -PathType Container) {
            Remove-Item -LiteralPath $workFull -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    catch { Write-Host "  ⓘ tozalash: ish papkasi o'chmadi (e'tiborsiz)" }
}
