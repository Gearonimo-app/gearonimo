# Gearonimo weekbackup - database + Storage-bestanden, versleuteld naar de
# externe schijf met de naam 'gearonimo'. Zie tools/backup/README.md.
#
# Draait dagelijks via Taakplanner, maar maakt alleen een backup als de
# vorige minstens een week oud is. Zo wordt een gemiste week (computer uit,
# schijf er niet in) vanzelf ingehaald.
#
# Dit bestand bewust in ASCII houden: Windows PowerShell 5.1 leest een .ps1
# zonder BOM als ANSI, dan worden letters als e-trema onleesbaar.

param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'config.json'),
    [string]$Target,     # alleen voor testen: map in plaats van de schijf
    [switch]$Force,      # ook als de vorige backup nog geen week oud is
    [switch]$Pause       # venster open laten (snelkoppeling op bureaublad)
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # voortgangsbalk maakt downloads in PS 5.1 traag
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$DriveLabel   = 'gearonimo'
$BackupFolder = 'gearonimo-backups'
$KeepCount    = 8      # aantal backups dat bewaard blijft
$IntervalDays = 6.5    # halve dag speling, zodat 'elke zondag 20:00' niet verschuift

$ToolDir   = $PSScriptRoot
$LogFile   = Join-Path $ToolDir 'backup.log'
$StateFile = Join-Path $ToolDir 'laatste-backup.txt'
$SevenZip  = Join-Path $ToolDir '7zip\x64\7za.exe'
$PgDump    = Join-Path $ToolDir 'pg\pgsql\bin\pg_dump.exe'

function Write-Log([string]$Message) {
    $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    Write-Host $line
}

function Show-Message([string]$Text, [string]$Icon = 'Warning') {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        [void][System.Windows.Forms.MessageBox]::Show($Text, 'Gearonimo backup', 'OK', $Icon)
    } catch {
        Write-Host $Text
    }
}

function Exit-Script([int]$Code) {
    if ($Pause) { Read-Host 'Druk op Enter om dit venster te sluiten' | Out-Null }
    exit $Code
}

# Geheimen staan in config.json versleuteld met Windows DPAPI: alleen dit
# Windows-account op deze computer kan ze teruglezen.
function Unprotect-Secret([string]$Value) {
    if ($Config.testPlainSecrets) { return $Value }
    $secure = ConvertTo-SecureString $Value
    return (New-Object System.Management.Automation.PSCredential 'x', $secure).GetNetworkCredential().Password
}

# Start-Process in plaats van '&': in PS 5.1 wordt elke stderr-regel van een
# extern programma (pg_dump meldt ook onschuldige dingen) anders een fout.
function Invoke-Tool([string]$Exe, [string[]]$Arguments, [string]$What) {
    $quoted = foreach ($a in $Arguments) {
        if ($a -match '[\s"]') { '"' + ($a -replace '"', '\"') + '"' } else { $a }
    }
    $errFile = Join-Path $ToolDir 'stderr.tmp'
    $outFile = Join-Path $ToolDir 'stdout.tmp'
    $p = Start-Process -FilePath $Exe -ArgumentList ($quoted -join ' ') -NoNewWindow -Wait -PassThru `
        -RedirectStandardError $errFile -RedirectStandardOutput $outFile
    $err = (Get-Content $errFile -Raw -ErrorAction SilentlyContinue)
    Remove-Item $errFile, $outFile -ErrorAction SilentlyContinue
    if ($p.ExitCode -ne 0) { throw "$What mislukt (code $($p.ExitCode)): $err" }
}

function Find-BackupRoot {
    if ($Target) { return $Target }
    $disk = Get-CimInstance Win32_LogicalDisk | Where-Object { $_.VolumeName -eq $DriveLabel } | Select-Object -First 1
    if ($disk) { return ($disk.DeviceID + '\') }
    return $null
}

# Invoke-RestMethod geeft in PS 5.1 een JSON-array soms als 1 object terug;
# via de pipeline plat slaan geeft altijd een gewone lijst.
function Invoke-Storage([string]$Method, [string]$Path, $Body) {
    $params = @{ Method = $Method; Uri = "$SupabaseUrl/storage/v1/$Path"; Headers = $StorageHeaders; UseBasicParsing = $true }
    if ($null -ne $Body) {
        $params.ContentType = 'application/json'
        $params.Body = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Compress))
    }
    return @(Invoke-RestMethod @params | ForEach-Object { $_ })
}

function Get-StorageFiles([string]$Bucket, [string]$Prefix) {
    $files = New-Object System.Collections.Generic.List[string]
    $offset = 0
    do {
        $body = @{ prefix = $Prefix; limit = 1000; offset = $offset; sortBy = @{ column = 'name'; order = 'asc' } }
        $items = Invoke-Storage 'Post' "object/list/$Bucket" $body
        foreach ($item in $items) {
            $path = if ($Prefix) { "$Prefix/$($item.name)" } else { $item.name }
            # Een map heeft geen id; daar recursief in duiken.
            if ($null -eq $item.id) { foreach ($f in (Get-StorageFiles $Bucket $path)) { $files.Add($f) } }
            else { $files.Add($path) }
        }
        $offset += $items.Count
    } while ($items.Count -eq 1000)
    return $files
}

# --- Start -------------------------------------------------------------------

if (-not (Test-Path $ConfigPath)) {
    Show-Message "Geen instellingen gevonden ($ConfigPath). Draai eerst INSTALLEREN.cmd."
    Exit-Script 1
}
$Config = Get-Content $ConfigPath -Raw | ConvertFrom-Json

if (-not $Force -and (Test-Path $StateFile)) {
    $last = [datetime]::ParseExact((Get-Content $StateFile -TotalCount 1).Trim(), 'yyyy-MM-dd HH:mm:ss', $null)
    if (((Get-Date) - $last).TotalDays -lt $IntervalDays) { exit 0 }
}

$root = Find-BackupRoot
if (-not $root) {
    Write-Log "Backup nodig, maar schijf '$DriveLabel' niet gevonden."
    Show-Message ("De wekelijkse backup is nodig, maar de backup-schijf '$DriveLabel' zit niet in de computer.`n`n" +
        "Steek de schijf erin en dubbelklik op 'Gearonimo backup nu maken' op je bureaublad.")
    Exit-Script 1
}

$stamp   = Get-Date -Format 'yyyy-MM-dd'
$work    = Join-Path ([IO.Path]::GetTempPath()) "gearonimo-backup-$stamp"
$destDir = Join-Path $root $BackupFolder
$archive = Join-Path $destDir "gearonimo-$stamp.7z"
$partial = "$archive.bezig"

try {
    Write-Log "Backup gestart naar $destDir"
    if (Test-Path $work) { Remove-Item $work -Recurse -Force }
    New-Item -ItemType Directory -Path $work | Out-Null
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null

    $SupabaseUrl = $Config.supabaseUrl.TrimEnd('/')
    $serviceKey  = Unprotect-Secret $Config.serviceKey
    # Nieuwe sleutels (sb_secret_...) zijn geen JWT en horen alleen in 'apikey'.
    $StorageHeaders = @{ apikey = $serviceKey }
    if (-not $serviceKey.StartsWith('sb_')) { $StorageHeaders.Authorization = "Bearer $serviceKey" }

    # 1. Database. Tabellen, functies en gegevens van het schema public, plus
    #    de gebruikersaccounts (auth.users/identities) waar die naar verwijzen.
    $env:PGPASSWORD = Unprotect-Secret $Config.dbPassword
    $env:PGSSLMODE  = if ($Config.db.sslmode) { $Config.db.sslmode } else { 'require' }
    $conn = @('-h', $Config.db.host, '-p', [string]$Config.db.port, '-U', $Config.db.user, '-d', $Config.db.database,
              '--no-owner', '--no-privileges')
    Write-Log 'Database ophalen...'
    Invoke-Tool $PgDump ($conn + @('-n', 'public', '-f', (Join-Path $work 'database-public.sql'))) 'Database (public)'
    Invoke-Tool $PgDump ($conn + @('--data-only', '-t', 'auth.users', '-t', 'auth.identities',
        '-f', (Join-Path $work 'database-accounts.sql'))) 'Database (accounts)'
    Remove-Item Env:\PGPASSWORD

    # 2. Storage (foto's, certificaten, logo's, handtekeningen...). Alle
    #    buckets, zodat een nieuwe bucket vanzelf meegaat.
    Write-Log 'Bestanden ophalen...'
    $storageDir = Join-Path $work 'bestanden'
    $fileCount = 0
    $failed = New-Object System.Collections.Generic.List[string]
    foreach ($bucket in (Invoke-Storage 'Get' 'bucket' $null)) {
        foreach ($path in (Get-StorageFiles $bucket.id '')) {
            $dest = Join-Path $storageDir $bucket.id
            foreach ($segment in $path.Split('/')) { $dest = Join-Path $dest $segment }
            $encoded = ($path.Split('/') | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
            try {
                New-Item -ItemType Directory -Path (Split-Path $dest) -Force | Out-Null
                Invoke-WebRequest -Uri "$SupabaseUrl/storage/v1/object/authenticated/$($bucket.id)/$encoded" `
                    -Headers $StorageHeaders -OutFile $dest -UseBasicParsing
                $fileCount++
            } catch {
                $failed.Add("$($bucket.id)/$path  ($($_.Exception.Message))")
            }
        }
    }
    Write-Log "$fileCount bestanden opgehaald, $($failed.Count) mislukt."

    $info = @(
        "Gearonimo backup van $(Get-Date -Format 'yyyy-MM-dd HH:mm')",
        "Project: $SupabaseUrl",
        '',
        'database-public.sql    alle tabellen, functies en gegevens (schema public)',
        'database-accounts.sql  inlogaccounts (auth.users en auth.identities)',
        "bestanden\             $fileCount bestanden uit Supabase Storage, per bucket",
        '',
        'Terugzetten: zie tools/backup/README.md in de Gearonimo-code.'
    )
    if ($failed.Count -gt 0) { $info += @('', 'NIET opgehaald:') + $failed }
    Set-Content -Path (Join-Path $work 'LEESMIJ.txt') -Value $info -Encoding UTF8

    # 3. Versleuteld inpakken (-mhe: ook bestandsnamen verborgen), eerst onder
    #    een tijdelijke naam zodat een half bestand nooit op een backup lijkt.
    Write-Log 'Versleuteld inpakken...'
    $password = Unprotect-Secret $Config.backupPassword
    Remove-Item $partial -ErrorAction SilentlyContinue
    Invoke-Tool $SevenZip @('a', '-t7z', '-mhe=on', '-mx=5', "-p$password", $partial, (Join-Path $work '*')) 'Inpakken'
    Invoke-Tool $SevenZip @('t', "-p$password", $partial) 'Controle van de backup'
    Move-Item -Path $partial -Destination $archive -Force

    # 4. Oude backups opruimen.
    Get-ChildItem -Path $destDir -Filter 'gearonimo-*.7z' | Sort-Object Name -Descending |
        Select-Object -Skip $KeepCount | Remove-Item

    Set-Content -Path $StateFile -Value (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') -Encoding ASCII
    $sizeMb = [math]::Round((Get-Item $archive).Length / 1MB, 1)
    Write-Log "Klaar: $archive ($sizeMb MB)"

    if ($failed.Count -gt 0) {
        Show-Message ("Backup gemaakt, maar $($failed.Count) bestand(en) konden niet worden opgehaald. " +
            "Zie LEESMIJ.txt in de backup of $LogFile.")
    } elseif ($Pause) {
        Show-Message "Backup gelukt: $archive ($sizeMb MB)" 'Information'
    }
    $exitCode = 0
} catch {
    Write-Log "MISLUKT: $($_.Exception.Message)"
    Remove-Item $partial -ErrorAction SilentlyContinue
    Show-Message ("De Gearonimo backup is mislukt.`n`n$($_.Exception.Message)`n`n" +
        "Stuur dit bericht of het logboek ($LogFile) naar Claude.") 'Error'
    $exitCode = 1
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    # De werkmap bevat klantgegevens onversleuteld: altijd weghalen.
    if (Test-Path $work) { Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue }
}
Exit-Script $exitCode
