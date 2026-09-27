# Installeert de Gearonimo weekbackup op deze Windows-computer.
# Start via INSTALLEREN.cmd (dubbelklikken). Zie tools/backup/README.md.
# Opnieuw draaien mag: dan worden de instellingen overschreven.
#
# Dit bestand bewust in ASCII houden (zie backup.ps1).

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ToolDir  = Join-Path $env:LOCALAPPDATA 'GearonimoBackup'
$TaskName = 'Gearonimo backup'

# Vaste versies met controlegetal: een gewijzigd of vervalst bestand wordt geweigerd.
$Downloads = @{
    SevenZr    = @{ Url = 'https://www.7-zip.org/a/7zr.exe'
                    Sha256 = 'AD4C82FADCBDF93C03B4FC440F300509C7D60C5C2F4D183E35D9D70D6957037D' }
    SevenExtra = @{ Url = 'https://www.7-zip.org/a/7z2501-extra.7z'
                    Sha256 = 'CD3CF38085C2CC6839CF72716DAFB3175AE425F4FD34FAAFC6C0B64D618D307F' }
    Postgres   = @{ Url = 'https://get.enterprisedb.com/postgresql/postgresql-17.6-1-windows-x64-binaries.zip'
                    Sha256 = 'D378882ABD001A186735ACD6F6BA716BCA6CCD192E800412D4FD15ED25376B3E' }
}

function Write-Step([string]$Text) { Write-Host ''; Write-Host "== $Text ==" -ForegroundColor Cyan }
function Write-Ok([string]$Text)   { Write-Host "   OK: $Text" -ForegroundColor Green }

function Get-File([hashtable]$Item, [string]$Dest) {
    Invoke-WebRequest -Uri $Item.Url -OutFile $Dest -UseBasicParsing
    $hash = (Get-FileHash -Path $Dest -Algorithm SHA256).Hash
    if ($hash -ne $Item.Sha256) {
        Remove-Item $Dest
        throw "Download van $($Item.Url) klopt niet (controlegetal wijkt af). Niet gebruikt."
    }
}

function Read-Plain([string]$Prompt) {
    $secure = Read-Host -Prompt $Prompt -AsSecureString
    return (New-Object System.Management.Automation.PSCredential 'x', $secure).GetNetworkCredential().Password
}

function Protect-Secret([string]$Plain) {
    return (ConvertTo-SecureString $Plain -AsPlainText -Force | ConvertFrom-SecureString)
}

# In PS 5.1 wordt stderr bij '2>&1' onder 'Stop' een fout; hier lokaal uit.
function Invoke-Quiet([string]$Exe, [string[]]$Arguments) {
    $ErrorActionPreference = 'Continue'
    $out = & $Exe @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "$Exe mislukt: $($out -join ' ')" }
}

try {
    Write-Host 'Gearonimo backup installeren' -ForegroundColor Cyan
    Write-Host "Alles komt in: $ToolDir"
    New-Item -ItemType Directory -Path $ToolDir -Force | Out-Null

    # --- 1. 7-Zip (versleutelen) -----------------------------------------
    Write-Step 'Stap 1 van 5: 7-Zip ophalen'
    $sevenZip = Join-Path $ToolDir '7zip\x64\7za.exe'
    if (-not (Test-Path $sevenZip)) {
        $zr = Join-Path $ToolDir '7zr.exe'
        $extra = Join-Path $ToolDir '7z-extra.7z'
        Get-File $Downloads.SevenZr $zr
        Get-File $Downloads.SevenExtra $extra
        Invoke-Quiet $zr @('x', $extra, "-o$(Join-Path $ToolDir '7zip')", 'x64\*', '-y')
        Remove-Item $zr, $extra
    }
    Write-Ok '7-Zip staat klaar'

    # --- 2. PostgreSQL-hulpprogramma (database ophalen) ------------------
    Write-Step 'Stap 2 van 5: database-hulpprogramma ophalen (ruim 300 MB, even geduld)'
    $pgBin = Join-Path $ToolDir 'pg\pgsql\bin'
    $pgDump = Join-Path $pgBin 'pg_dump.exe'
    if (-not (Test-Path $pgDump)) {
        $zip = Join-Path $ToolDir 'postgresql.zip'
        Get-File $Downloads.Postgres $zip
        # Alleen de programma's, niet pgAdmin. De Visual C++-runtime pakken we uit
        # pgAdmin mee, zodat er niets met beheerdersrechten geinstalleerd hoeft.
        Invoke-Quiet $sevenZip @('x', $zip, "-o$(Join-Path $ToolDir 'pg')", 'pgsql\bin\*', '-y')
        Invoke-Quiet $sevenZip @('e', $zip, "-o$pgBin", 'pgsql\pgAdmin 4\python\vcruntime140.dll',
            'pgsql\pgAdmin 4\python\vcruntime140_1.dll', '-y')
        Remove-Item $zip
    }
    Invoke-Quiet $pgDump @('--version')
    Write-Ok 'database-hulpprogramma werkt'

    # --- 3. Gegevens van Supabase ----------------------------------------
    Write-Step 'Stap 3 van 5: verbinding met Supabase'
    Write-Host 'Plak de "Session pooler"-verbinding (Supabase > Connect). Rechtermuisknop = plakken.'
    while ($true) {
        $uri = (Read-Host 'Verbinding').Trim()
        # postgresql://postgres.<ref>:[YOUR-PASSWORD]@<host>:<poort>/<database>
        if ($uri -match '^postgres(?:ql)?://(?<user>[^:@/]+)(?::[^@]*)?@(?<host>[^:/?]+)(?::(?<port>\d+))?/(?<db>[^?]+)') {
            $db = [ordered]@{ host = $Matches.host; port = 5432; user = $Matches.user; database = $Matches.db; sslmode = 'require' }
            if ($Matches.port) { $db.port = [int]$Matches.port }
            if ($db.user -match '^postgres\.(?<ref>[a-z0-9]+)$') { $ref = $Matches.ref }
            elseif ($db.host -match '^db\.(?<ref>[a-z0-9]+)\.supabase\.co$') { $ref = $Matches.ref }
            else { Write-Host '   Hier staat geen Supabase-projectcode in. Probeer opnieuw.' -ForegroundColor Yellow; continue }
            break
        }
        Write-Host '   Dat lijkt geen verbinding (moet beginnen met postgresql://). Probeer opnieuw.' -ForegroundColor Yellow
    }
    $supabaseUrl = "https://$ref.supabase.co"
    Write-Ok "project $ref"

    $psql = Join-Path $pgBin 'psql.exe'
    while ($true) {
        $dbPassword = Read-Plain 'Database-wachtwoord (je ziet niets tijdens typen/plakken, dat klopt)'
        $env:PGPASSWORD = $dbPassword; $env:PGSSLMODE = 'require'
        try { Invoke-Quiet $psql @('-h', $db.host, '-p', [string]$db.port, '-U', $db.user, '-d', $db.database, '-tAc', 'select 1'); $ok = $true }
        catch { $ok = $false; $why = $_.Exception.Message }
        Remove-Item Env:\PGPASSWORD
        if ($ok) { break }
        Write-Host "   Verbinden lukt niet: $why" -ForegroundColor Yellow
        Write-Host '   Klopt het wachtwoord? Probeer opnieuw.' -ForegroundColor Yellow
    }
    Write-Ok 'database bereikbaar'

    while ($true) {
        $serviceKey = (Read-Plain 'Secret key (Supabase > Settings > API Keys)').Trim()
        $headers = @{ apikey = $serviceKey }
        if (-not $serviceKey.StartsWith('sb_')) { $headers.Authorization = "Bearer $serviceKey" }
        try {
            $buckets = @(Invoke-RestMethod -Uri "$supabaseUrl/storage/v1/bucket" -Headers $headers -UseBasicParsing | ForEach-Object { $_ })
            break
        } catch {
            Write-Host "   Sleutel werkt niet: $($_.Exception.Message). Probeer opnieuw." -ForegroundColor Yellow
        }
    }
    Write-Ok ("bestanden bereikbaar (mappen: " + (($buckets | ForEach-Object { $_.id }) -join ', ') + ')')

    # --- 4. Backup-wachtwoord ---------------------------------------------
    Write-Step 'Stap 4 van 5: wachtwoord voor de backups'
    Write-Host 'Kies een wachtwoord van minstens 12 tekens en SCHRIJF HET OP.' -ForegroundColor Yellow
    Write-Host 'Zonder dit wachtwoord kan niemand de backups openen, ook jij niet.' -ForegroundColor Yellow
    while ($true) {
        $pw1 = Read-Plain 'Backup-wachtwoord'
        $pw2 = Read-Plain 'Nog een keer ter controle'
        if ($pw1 -ne $pw2) { Write-Host '   Niet gelijk. Opnieuw.' -ForegroundColor Yellow; continue }
        if ($pw1.Length -lt 12) { Write-Host '   Te kort (minstens 12 tekens). Opnieuw.' -ForegroundColor Yellow; continue }
        break
    }

    $config = [ordered]@{
        supabaseUrl    = $supabaseUrl
        db             = $db
        dbPassword     = Protect-Secret $dbPassword
        serviceKey     = Protect-Secret $serviceKey
        backupPassword = Protect-Secret $pw1
    }
    $config | ConvertTo-Json | Set-Content -Path (Join-Path $ToolDir 'config.json') -Encoding UTF8
    Copy-Item -Path (Join-Path $PSScriptRoot 'backup.ps1') -Destination $ToolDir -Force
    Write-Ok 'instellingen opgeslagen (versleuteld, alleen leesbaar voor jouw Windows-account)'

    # --- 5. Planning en snelkoppeling --------------------------------------
    Write-Step 'Stap 5 van 5: elke week automatisch'
    $script = Join-Path $ToolDir 'backup.ps1'
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
        -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 3)
    $daily = New-ScheduledTaskTrigger -Daily -At '20:00'
    try {
        $logon = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($daily, $logon) -Settings $settings -Force | Out-Null
        Write-Ok 'controle elke avond om 20:00 en bij inloggen; backup als de vorige een week oud is'
    } catch {
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $daily -Settings $settings -Force | Out-Null
        Write-Ok 'controle elke avond om 20:00; backup als de vorige een week oud is'
    }

    $shell = New-Object -ComObject WScript.Shell
    $lnk = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Gearonimo backup nu maken.lnk'))
    $lnk.TargetPath = 'powershell.exe'
    $lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -Force -Pause"
    $lnk.WorkingDirectory = $ToolDir
    $lnk.Save()
    Write-Ok "snelkoppeling 'Gearonimo backup nu maken' op je bureaublad"

    Write-Host ''
    Write-Host 'Installatie klaar.' -ForegroundColor Green
    $answer = Read-Host 'Nu meteen de eerste backup maken? Zit de schijf erin? (j/n)'
    if ($answer -match '^[jJyY]') {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script -Force
    }
} catch {
    Write-Host ''
    Write-Host "Er ging iets mis: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Maak een foto of kopie van dit venster en stuur het naar Claude.' -ForegroundColor Red
}
