[CmdletBinding()]
param(
    [string]$GeoServerUrl = 'http://localhost:8081/geoserver',
    [string]$Workspace = 'webgistest',
    [pscredential]$Credential,
    [string]$OutputDirectory,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot 'lib\GeoServerConfig.psm1') -Force

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $PSScriptRoot 'config'
}
if ($null -eq $Credential) {
    $Credential = Get-Credential -Message "Enter GeoServer administrator credentials for $GeoServerUrl"
}

function Get-EndpointSegment {
    param([Parameter(Mandatory)][string]$Value)
    return [Uri]::EscapeDataString($Value)
}

function Get-RelativePath {
    param([Parameter(Mandatory)][string[]]$Segments)
    return ($Segments -join '/')
}

function Get-AbsolutePath {
    param([Parameter(Mandatory)][string]$RelativePath)
    return Join-Path $OutputDirectory ($RelativePath -replace '/', '\\')
}

$base = $GeoServerUrl.TrimEnd('/') + '/rest'
$headers = New-GeoServerHeaders -Credential $Credential
$workspaceSegment = Get-EndpointSegment -Value $Workspace

if (Test-Path $OutputDirectory) {
    if (-not $Force) {
        throw "Output directory already exists: $OutputDirectory. Re-run with -Force to replace the generated configuration."
    }
    Remove-Item -LiteralPath $OutputDirectory -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$workspaceResponse = Invoke-GeoServerRestRequest -Uri "$base/workspaces/$workspaceSegment.json" -Headers $headers
$namespaceResponse = Invoke-GeoServerRestRequest -Uri "$base/namespaces/$workspaceSegment.json" -Headers $headers

Write-GeoServerJson -Value (ConvertTo-GeoServerWorkspaceManifest -Workspace $workspaceResponse) -Path (Get-AbsolutePath -RelativePath 'workspace.json')
Write-GeoServerJson -Value (ConvertTo-GeoServerNamespaceManifest -Namespace $namespaceResponse) -Path (Get-AbsolutePath -RelativePath 'namespace.json')

$dataStoresResponse = Invoke-GeoServerRestRequest -Uri "$base/workspaces/$workspaceSegment/datastores.json" -Headers $headers
$dataStoreEntries = @()
$styleNames = New-Object 'System.Collections.Generic.HashSet[string]'
$workspaceStyleNames = New-Object 'System.Collections.Generic.HashSet[string]'

foreach ($style in Get-GeoServerCollectionItems -Response (Invoke-GeoServerRestRequest -Uri "$base/workspaces/$workspaceSegment/styles.json" -Headers $headers) -ContainerName 'styles' -ItemName 'style') {
    if (-not [string]::IsNullOrWhiteSpace([string]$style.name)) {
        [void]$workspaceStyleNames.Add([string]$style.name)
        [void]$styleNames.Add([string]$style.name)
    }
}

foreach ($dataStoreSummary in Get-GeoServerCollectionItems -Response $dataStoresResponse -ContainerName 'dataStores' -ItemName 'dataStore') {
    $dataStoreName = [string]$dataStoreSummary.name
    $dataStoreSegment = Get-EndpointSegment -Value $dataStoreName
    $dataStoreResponse = Invoke-GeoServerRestRequest -Uri "$base/workspaces/$workspaceSegment/datastores/$dataStoreSegment.json" -Headers $headers

    $dataStoreFile = Get-RelativePath -Segments @('datastores', "$(ConvertTo-GeoServerSafeFileName -Name $dataStoreName).json")
    Write-GeoServerJson -Value (ConvertTo-GeoServerDataStoreTemplate -DataStore $dataStoreResponse) -Path (Get-AbsolutePath -RelativePath $dataStoreFile)

    $featureTypeEntries = @()
    $featureTypesResponse = Invoke-GeoServerRestRequest -Uri "$base/workspaces/$workspaceSegment/datastores/$dataStoreSegment/featuretypes.json" -Headers $headers
    foreach ($featureTypeSummary in Get-GeoServerCollectionItems -Response $featureTypesResponse -ContainerName 'featureTypes' -ItemName 'featureType') {
        $featureTypeName = [string]$featureTypeSummary.name
        $featureTypeSegment = Get-EndpointSegment -Value $featureTypeName
        $featureTypeResponse = Invoke-GeoServerRestRequest -Uri "$base/workspaces/$workspaceSegment/datastores/$dataStoreSegment/featuretypes/$featureTypeSegment.json" -Headers $headers
        $featureTypeManifest = ConvertTo-GeoServerFeatureTypeManifest -FeatureType $featureTypeResponse

        $featureTypeFile = Get-RelativePath -Segments @('featuretypes', (ConvertTo-GeoServerSafeFileName -Name $dataStoreName), "$(ConvertTo-GeoServerSafeFileName -Name $featureTypeName).json")
        Write-GeoServerJson -Value $featureTypeManifest -Path (Get-AbsolutePath -RelativePath $featureTypeFile)

        $layerKey = "$Workspace`:$featureTypeName"
        $layerResponse = Invoke-GeoServerRestRequest -Uri "$base/layers/$(Get-EndpointSegment -Value $layerKey).json" -Headers $headers
        $layerManifest = ConvertTo-GeoServerLayerManifest -Layer $layerResponse
        $layerFile = Get-RelativePath -Segments @('layers', "$(ConvertTo-GeoServerSafeFileName -Name $featureTypeName).json")
        Write-GeoServerJson -Value $layerManifest -Path (Get-AbsolutePath -RelativePath $layerFile)

        foreach ($styleName in Get-GeoServerLayerStyleNames -LayerManifest $layerManifest) {
            [void]$styleNames.Add($styleName)
        }

        $featureTypeEntries += [PSCustomObject]@{
            name            = $featureTypeName
            featureTypeFile = $featureTypeFile
            layerFile       = $layerFile
        }
    }

    $dataStoreEntries += [PSCustomObject]@{
        name         = $dataStoreName
        dataStoreFile = $dataStoreFile
        featureTypes = $featureTypeEntries
    }
}

$globalStylesResponse = Invoke-GeoServerRestRequest -Uri "$base/styles.json" -Headers $headers
$globalStyleNames = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($style in Get-GeoServerCollectionItems -Response $globalStylesResponse -ContainerName 'styles' -ItemName 'style') {
    if (-not [string]::IsNullOrWhiteSpace([string]$style.name)) {
        [void]$globalStyleNames.Add([string]$style.name)
    }
}

$styleEntries = @()
foreach ($styleName in $styleNames | Sort-Object) {
    $scope = if ($workspaceStyleNames.Contains($styleName)) { 'workspace' } elseif ($globalStyleNames.Contains($styleName)) { 'global' } else { throw "Style '$styleName' is referenced by the workspace but cannot be found." }
    $styleSegment = Get-EndpointSegment -Value $styleName
    $styleUri = if ($scope -eq 'workspace') { "$base/workspaces/$workspaceSegment/styles/$styleSegment.sld" } else { "$base/styles/$styleSegment.sld" }
    $styleFile = Get-RelativePath -Segments @('styles', $scope, "$(ConvertTo-GeoServerSafeFileName -Name $styleName).sld")
    $stylePath = Get-AbsolutePath -RelativePath $styleFile

    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $stylePath) | Out-Null
    Invoke-GeoServerRawRequest -Uri $styleUri -Headers (New-GeoServerHeaders -Credential $Credential -Accept 'application/vnd.ogc.sld+xml') -OutFile $stylePath
    $styleEntries += [PSCustomObject]@{ name = $styleName; scope = $scope; file = $styleFile }
}

$manifest = [PSCustomObject]@{
    schemaVersion = 1
    exportedAt    = [DateTime]::UtcNow.ToString('o')
    workspace     = $Workspace
    workspaceFile = 'workspace.json'
    namespaceFile = 'namespace.json'
    dataStores    = $dataStoreEntries
    styles        = $styleEntries
}
Write-GeoServerJson -Value $manifest -Path (Get-AbsolutePath -RelativePath 'manifest.json')

Write-Host "Exported workspace '$Workspace' to $OutputDirectory"
