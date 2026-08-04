[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$GeoServerUrl = 'http://localhost:8081/geoserver',
    [pscredential]$Credential,
    [string]$ConfigDirectory,
    [hashtable]$TemplateVariables = @{},
    [string]$TargetWorkspace,
    [string]$TargetWorkspaceUri,
    [switch]$SkipGlobalStyles
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot 'lib\GeoServerConfig.psm1') -Force

if ([string]::IsNullOrWhiteSpace($ConfigDirectory)) {
    $ConfigDirectory = Join-Path $PSScriptRoot 'config'
}
if ($null -eq $Credential) {
    $Credential = Get-Credential -Message "Enter GeoServer administrator credentials for $GeoServerUrl"
}

function Get-EndpointSegment {
    param([Parameter(Mandatory)][string]$Value)
    return [Uri]::EscapeDataString($Value)
}

function Get-ConfigPath {
    param([Parameter(Mandatory)][string]$RelativePath)
    return Join-Path $ConfigDirectory ($RelativePath -replace '/', '\\')
}

function Get-TemplateVariables {
    param([Parameter(Mandatory)][hashtable]$Provided)

    $variables = @{}
    foreach ($name in @(
        'GEOSERVER_DATASTORE_HOST',
        'GEOSERVER_DATASTORE_PORT',
        'GEOSERVER_DATASTORE_DATABASE',
        'GEOSERVER_DATASTORE_USER',
        'GEOSERVER_DATASTORE_PASSWORD',
        'GEOSERVER_WORKSPACE_URI'
    )) {
        if ($Provided.ContainsKey($name) -and -not [string]::IsNullOrWhiteSpace([string]$Provided[$name])) {
            $variables[$name] = [string]$Provided[$name]
            continue
        }

        $environmentValue = [Environment]::GetEnvironmentVariable($name, 'Process')
        if (-not [string]::IsNullOrWhiteSpace($environmentValue)) {
            $variables[$name] = $environmentValue
        }
    }
    return $variables
}

function Read-ResolvedGeoServerJson {
    param(
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)][hashtable]$Variables
    )

    $content = Get-Content -Raw -Encoding UTF8 -Path (Get-ConfigPath -RelativePath $RelativePath)
    return (Resolve-GeoServerTemplate -Content $content -Variables $Variables) | ConvertFrom-Json
}

function Test-GeoServerResource {
    param([Parameter(Mandatory)][string]$Uri)
    return $null -ne (Invoke-GeoServerRestRequest -Uri $Uri -Headers $headers -IgnoreNotFound)
}

function Invoke-GeoServerJsonUpsert {
    param(
        [Parameter(Mandatory)][string]$CollectionUri,
        [Parameter(Mandatory)][string]$ResourceUri,
        [Parameter(Mandatory)][object]$Payload,
        [Parameter(Mandatory)][string]$Description
    )

    $method = if (Test-GeoServerResource -Uri $ResourceUri) { 'Put' } else { 'Post' }
    $uri = if ($method -eq 'Put') { $ResourceUri } else { $CollectionUri }
    $body = $Payload | ConvertTo-Json -Depth 100
    if ($PSCmdlet.ShouldProcess($uri, "$method $Description")) {
        Invoke-GeoServerRestRequest -Uri $uri -Method $method -Headers $headers -Body $body -ContentType 'application/json' | Out-Null
    }
}

function Invoke-GeoServerStyleUpsert {
    param(
        [Parameter(Mandatory)][pscustomobject]$Style,
        [Parameter(Mandatory)][string]$WorkspaceName
    )

    $styleName = [string]$Style.name
    $styleSegment = Get-EndpointSegment -Value $styleName
    $isWorkspaceStyle = [string]$Style.scope -eq 'workspace'
    $collectionUri = if ($isWorkspaceStyle) { "$base/workspaces/$workspaceSegment/styles" } else { "$base/styles" }
    $resourceUri = if ($isWorkspaceStyle) { "$base/workspaces/$workspaceSegment/styles/$styleSegment.json" } else { "$base/styles/$styleSegment.json" }
    $contentUri = if ($isWorkspaceStyle) { "$base/workspaces/$workspaceSegment/styles/$styleSegment.sld" } else { "$base/styles/$styleSegment.sld" }
    $sldPath = Get-ConfigPath -RelativePath ([string]$Style.file)
    $body = [Text.Encoding]::UTF8.GetBytes((Get-Content -Raw -Encoding UTF8 -Path $sldPath))
    $method = if (Test-GeoServerResource -Uri $resourceUri) { 'Put' } else { 'Post' }
    $uri = if ($method -eq 'Put') { $contentUri } else { "${collectionUri}?name=$styleSegment" }

    if ($PSCmdlet.ShouldProcess($uri, "$method $([string]$Style.scope) style '$styleName'")) {
        Invoke-GeoServerRestRequest -Uri $uri -Method $method -Headers $headers -Body $body -ContentType 'application/vnd.ogc.sld+xml; charset=UTF-8' | Out-Null
    }
}

$manifestPath = Join-Path $ConfigDirectory 'manifest.json'
if (-not (Test-Path $manifestPath)) {
    throw "GeoServer manifest does not exist: $manifestPath"
}

$manifest = Read-GeoServerJson -Path $manifestPath
$namespace = Read-GeoServerJson -Path (Get-ConfigPath -RelativePath ([string]$manifest.namespaceFile))
$target = Resolve-GeoServerTargetWorkspace `
    -SourceWorkspace ([string]$manifest.workspace) `
    -SourceUri ([string]$namespace.namespace.uri) `
    -TargetWorkspace $TargetWorkspace `
    -TargetWorkspaceUri $TargetWorkspaceUri
$workspaceName = [string]$target.name
$workspaceSegment = Get-EndpointSegment -Value $workspaceName
$base = $GeoServerUrl.TrimEnd('/') + '/rest'
$headers = New-GeoServerHeaders -Credential $Credential

$variables = Get-TemplateVariables -Provided $TemplateVariables
if (-not [string]::IsNullOrWhiteSpace($TargetWorkspace)) {
    $variables['GEOSERVER_WORKSPACE_URI'] = [string]$target.uri
} elseif (-not $variables.ContainsKey('GEOSERVER_WORKSPACE_URI')) {
    $variables['GEOSERVER_WORKSPACE_URI'] = [string]$target.uri
}

$workspace = Read-ResolvedGeoServerJson -RelativePath ([string]$manifest.workspaceFile) -Variables $variables
$workspace.workspace.name = $workspaceName
Invoke-GeoServerJsonUpsert -CollectionUri "$base/workspaces.json" -ResourceUri "$base/workspaces/$workspaceSegment.json" -Payload $workspace -Description "workspace '$workspaceName'"

$namespacePayload = Read-ResolvedGeoServerJson -RelativePath ([string]$manifest.namespaceFile) -Variables $variables
$namespacePayload.namespace.prefix = $workspaceName
$namespacePayload.namespace.uri = [string]$target.uri
Invoke-GeoServerJsonUpsert -CollectionUri "$base/namespaces.json" -ResourceUri "$base/namespaces/$workspaceSegment.json" -Payload $namespacePayload -Description "namespace '$workspaceName'"

foreach ($dataStoreEntry in @($manifest.dataStores)) {
    $dataStoreName = [string]$dataStoreEntry.name
    $dataStoreSegment = Get-EndpointSegment -Value $dataStoreName
    $dataStore = Read-ResolvedGeoServerJson -RelativePath ([string]$dataStoreEntry.dataStoreFile) -Variables $variables
    $dataStore.dataStore.workspace = [PSCustomObject]@{ name = $workspaceName }
    Invoke-GeoServerJsonUpsert -CollectionUri "$base/workspaces/$workspaceSegment/datastores.json" -ResourceUri "$base/workspaces/$workspaceSegment/datastores/$dataStoreSegment.json" -Payload $dataStore -Description "datastore '$dataStoreName'"

    foreach ($featureTypeEntry in @($dataStoreEntry.featureTypes)) {
        $featureTypeName = [string]$featureTypeEntry.name
        $featureTypeSegment = Get-EndpointSegment -Value $featureTypeName
        $featureType = Read-ResolvedGeoServerJson -RelativePath ([string]$featureTypeEntry.featureTypeFile) -Variables $variables
        Invoke-GeoServerJsonUpsert -CollectionUri "$base/workspaces/$workspaceSegment/datastores/$dataStoreSegment/featuretypes.json" -ResourceUri "$base/workspaces/$workspaceSegment/datastores/$dataStoreSegment/featuretypes/$featureTypeSegment.json" -Payload $featureType -Description "feature type '$featureTypeName'"
    }
}

foreach ($style in @($manifest.styles)) {
    if ($SkipGlobalStyles -and [string]$style.scope -eq 'global') {
        continue
    }
    Invoke-GeoServerStyleUpsert -Style $style -WorkspaceName $workspaceName
}

foreach ($dataStoreEntry in @($manifest.dataStores)) {
    foreach ($featureTypeEntry in @($dataStoreEntry.featureTypes)) {
        $featureTypeName = [string]$featureTypeEntry.name
        $layerKey = "$workspaceName`:$featureTypeName"
        $layerSegment = Get-EndpointSegment -Value $layerKey
        $layerUri = "$base/layers/$layerSegment.json"
        if (-not (Test-GeoServerResource -Uri $layerUri) -and -not $WhatIfPreference) {
            throw "GeoServer did not create layer '$layerKey' after publishing its feature type."
        }
        $layer = Read-ResolvedGeoServerJson -RelativePath ([string]$featureTypeEntry.layerFile) -Variables $variables
        if ($PSCmdlet.ShouldProcess($layerUri, "Put layer '$layerKey'")) {
            Invoke-GeoServerRestRequest -Uri $layerUri -Method Put -Headers $headers -Body ($layer | ConvertTo-Json -Depth 100) -ContentType 'application/json' | Out-Null
        }
    }
}

if ($PSCmdlet.ShouldProcess("$base/reload", 'Reload GeoServer catalog')) {
    Invoke-GeoServerRestRequest -Uri "$base/reload" -Method Post -Headers $headers | Out-Null
}

if ($WhatIfPreference) {
    Write-Host "Validated GeoServer workspace '$workspaceName' from $ConfigDirectory with -WhatIf; no write request was sent."
} else {
    Write-Host "Applied GeoServer workspace '$workspaceName' from $ConfigDirectory"
}
