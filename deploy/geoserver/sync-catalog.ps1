# GeoServer catalogue 一次性同步器。
#
# 该脚本在独立容器中运行：等待 GeoServer REST 可用，调用仓库现有 apply.ps1，
# 成功后把标记写进 Data Directory。标记存在时，普通 docker compose up 不会覆盖图层或样式。
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-RequiredEnvironmentValue {
    param([Parameter(Mandatory)][string]$Name)

    $value = [Environment]::GetEnvironmentVariable($Name, 'Process')
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Required environment variable '$Name' is empty."
    }
    return $value
}

function Test-EnabledFlag {
    param([string]$Value)

    return $Value -in @('1', 'true', 'TRUE', 'True', 'yes', 'YES', 'Yes')
}

$geoServerUrl = (Get-RequiredEnvironmentValue -Name 'GEOSERVER_URL').TrimEnd('/')
$adminUser = Get-RequiredEnvironmentValue -Name 'GEOSERVER_ADMIN_USER'
$adminPassword = Get-RequiredEnvironmentValue -Name 'GEOSERVER_ADMIN_PASSWORD'
$dataDirectory = Get-RequiredEnvironmentValue -Name 'GEOSERVER_DATA_DIR'
$markerPath = Join-Path $dataDirectory '.webgis-catalog-synced'
$forceSync = Test-EnabledFlag -Value ([Environment]::GetEnvironmentVariable('FORCE_CATALOG_SYNC', 'Process'))

if ((Test-Path -LiteralPath $markerPath) -and -not $forceSync) {
    Write-Host "GeoServer catalogue marker exists; skip synchronization: $markerPath"
    exit 0
}

# GeoServer 的容器已启动不代表 REST 已经可用；最多等待 5 分钟。
$securePassword = ConvertTo-SecureString -String $adminPassword -AsPlainText -Force
$credential = [PSCredential]::new($adminUser, $securePassword)
$readyUri = "$geoServerUrl/rest/about/status.json"
$isReady = $false

for ($attempt = 1; $attempt -le 60; $attempt++) {
    try {
        $response = Invoke-WebRequest -Uri $readyUri -Authentication Basic -Credential $credential -SkipHttpErrorCheck -TimeoutSec 5
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
            $isReady = $true
            break
        }
        Write-Host "GeoServer REST returned HTTP $($response.StatusCode); retrying ($attempt/60)."
    } catch {
        Write-Host "GeoServer REST is not ready yet; retrying ($attempt/60)."
    }
    Start-Sleep -Seconds 5
}

if (-not $isReady) {
    throw "GeoServer REST did not become ready within 5 minutes: $readyUri"
}

# 现有 apply.ps1 读取 manifest，并按 workspace -> datastore -> feature type -> style -> layer -> reload 的依赖顺序同步。
$templateVariables = @{
    GEOSERVER_DATASTORE_HOST = Get-RequiredEnvironmentValue -Name 'GEOSERVER_DATASTORE_HOST'
    GEOSERVER_DATASTORE_PORT = Get-RequiredEnvironmentValue -Name 'GEOSERVER_DATASTORE_PORT'
    GEOSERVER_DATASTORE_DATABASE = Get-RequiredEnvironmentValue -Name 'GEOSERVER_DATASTORE_DATABASE'
    GEOSERVER_DATASTORE_USER = Get-RequiredEnvironmentValue -Name 'GEOSERVER_DATASTORE_USER'
    GEOSERVER_DATASTORE_PASSWORD = Get-RequiredEnvironmentValue -Name 'GEOSERVER_DATASTORE_PASSWORD'
}

& /workspace/geoserver/apply.ps1 `
    -GeoServerUrl $geoServerUrl `
    -Credential $credential `
    -ConfigDirectory /workspace/geoserver/config `
    -TemplateVariables $templateVariables

if (-not $?) {
    throw 'GeoServer catalogue synchronization failed.'
}

Set-Content -LiteralPath $markerPath -Value "synchronized=$(Get-Date -AsUTC -Format o)" -Encoding utf8
Write-Host "GeoServer catalogue synchronization completed; marker written to $markerPath"
