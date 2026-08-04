Set-StrictMode -Version Latest

function Copy-GeoServerValue {
    param([AllowNull()][object]$Value)

    if ($null -eq $Value) {
        return $null
    }

    if ($Value -is [string] -or $Value.GetType().IsValueType) {
        return $Value
    }

    if ($Value -is [System.Collections.IDictionary]) {
        $copy = [ordered]@{}
        foreach ($key in $Value.Keys) {
            $copy[$key] = Copy-GeoServerValue -Value $Value[$key]
        }
        return [PSCustomObject]$copy
    }

    if ($Value -is [System.Collections.IEnumerable]) {
        return @($Value | ForEach-Object { Copy-GeoServerValue -Value $_ })
    }

    $copy = [ordered]@{}
    foreach ($property in $Value.PSObject.Properties) {
        $copy[$property.Name] = Copy-GeoServerValue -Value $property.Value
    }
    return [PSCustomObject]$copy
}

function Add-GeoServerPropertyIfPresent {
    param(
        [Parameter(Mandatory)][System.Collections.IDictionary]$Target,
        [Parameter(Mandatory)][object]$Source,
        [Parameter(Mandatory)][string]$Name
    )

    $property = $Source.PSObject.Properties[$Name]
    if ($null -ne $property) {
        $Target[$Name] = Copy-GeoServerValue -Value $property.Value
    }
}

function Get-GeoServerConnectionPlaceholder {
    param([Parameter(Mandatory)][string]$Key)

    $placeholders = @{
        host      = '${GEOSERVER_DATASTORE_HOST}'
        port      = '${GEOSERVER_DATASTORE_PORT}'
        database  = '${GEOSERVER_DATASTORE_DATABASE}'
        user      = '${GEOSERVER_DATASTORE_USER}'
        passwd    = '${GEOSERVER_DATASTORE_PASSWORD}'
        namespace = '${GEOSERVER_WORKSPACE_URI}'
    }

    if ($placeholders.ContainsKey($Key)) {
        return $placeholders[$Key]
    }

    return $null
}

function ConvertTo-GeoServerDataStoreTemplate {
    param([Parameter(Mandatory)][object]$DataStore)

    $source = $DataStore.dataStore
    if ($null -eq $source) {
        throw 'Expected a GeoServer dataStore response with a dataStore property.'
    }

    $target = [ordered]@{}
    foreach ($name in @('name', 'type', 'enabled', '_default', 'disableOnConnFailure')) {
        Add-GeoServerPropertyIfPresent -Target $target -Source $source -Name $name
    }

    if ($null -ne $source.workspace -and -not [string]::IsNullOrWhiteSpace([string]$source.workspace.name)) {
        $target.workspace = [PSCustomObject]@{ name = [string]$source.workspace.name }
    }

    $entries = @()
    if ($null -ne $source.connectionParameters -and $null -ne $source.connectionParameters.entry) {
        foreach ($entry in @($source.connectionParameters.entry)) {
            $key = [string]$entry.'@key'
            $value = Get-GeoServerConnectionPlaceholder -Key $key
            if ($null -eq $value) {
                $value = Copy-GeoServerValue -Value $entry.'$'
            }
            $entries += [PSCustomObject]@{
                '@key' = $key
                '$'    = $value
            }
        }
    }
    $target.connectionParameters = [PSCustomObject]@{ entry = $entries }

    return [PSCustomObject]@{ dataStore = [PSCustomObject]$target }
}

function ConvertTo-GeoServerFeatureTypeManifest {
    param([Parameter(Mandatory)][object]$FeatureType)

    $source = $FeatureType.featureType
    if ($null -eq $source) {
        throw 'Expected a GeoServer featureType response with a featureType property.'
    }

    $target = [ordered]@{}
    foreach ($name in @(
        'name', 'nativeName', 'title', 'abstract', 'keywords', 'srs',
        'projectionPolicy', 'enabled', 'advertised', 'metadata',
        'nativeBoundingBox', 'latLonBoundingBox', 'overridingServiceSRS',
        'skipNumberMatched', 'circularArcPresent', 'serviceConfiguration',
        'simpleConversionEnabled', 'maxFeatures', 'numDecimals',
        'padWithZeros', 'forcedDecimal'
    )) {
        Add-GeoServerPropertyIfPresent -Target $target -Source $source -Name $name
    }

    return [PSCustomObject]@{ featureType = [PSCustomObject]$target }
}

function ConvertTo-GeoServerStyleReference {
    param([AllowNull()][object]$Style)

    if ($null -eq $Style -or [string]::IsNullOrWhiteSpace([string]$Style.name)) {
        return $null
    }

    return [PSCustomObject]@{ name = [string]$Style.name }
}

function ConvertTo-GeoServerLayerManifest {
    param([Parameter(Mandatory)][object]$Layer)

    $source = $Layer.layer
    if ($null -eq $source) {
        throw 'Expected a GeoServer layer response with a layer property.'
    }

    $target = [ordered]@{}
    foreach ($name in @('name', 'enabled', 'advertised', 'queryable', 'opaque', 'attribution')) {
        Add-GeoServerPropertyIfPresent -Target $target -Source $source -Name $name
    }

    $defaultStyle = ConvertTo-GeoServerStyleReference -Style $source.defaultStyle
    if ($null -ne $defaultStyle) {
        $target.defaultStyle = $defaultStyle
    }

    $stylesProperty = $source.PSObject.Properties['styles']
    if ($null -ne $stylesProperty -and $null -ne $stylesProperty.Value) {
        $styleItemsProperty = $stylesProperty.Value.PSObject.Properties['style']
        $styleItems = if ($null -ne $styleItemsProperty) { @($styleItemsProperty.Value) } else { @() }
        $styles = @($styleItems | ForEach-Object { ConvertTo-GeoServerStyleReference -Style $_ } | Where-Object { $null -ne $_ })
        if ($styles.Count -gt 0) {
            $target.styles = [PSCustomObject]@{ style = $styles }
        }
    }

    return [PSCustomObject]@{ layer = [PSCustomObject]$target }
}

function ConvertTo-GeoServerWorkspaceManifest {
    param([Parameter(Mandatory)][object]$Workspace)

    $source = $Workspace.workspace
    if ($null -eq $source -or [string]::IsNullOrWhiteSpace([string]$source.name)) {
        throw 'Expected a GeoServer workspace response with a workspace.name property.'
    }

    return [PSCustomObject]@{ workspace = [PSCustomObject]@{ name = [string]$source.name } }
}

function ConvertTo-GeoServerNamespaceManifest {
    param([Parameter(Mandatory)][object]$Namespace)

    $source = $Namespace.namespace
    if ($null -eq $source -or [string]::IsNullOrWhiteSpace([string]$source.prefix) -or [string]::IsNullOrWhiteSpace([string]$source.uri)) {
        throw 'Expected a GeoServer namespace response with namespace.prefix and namespace.uri properties.'
    }

    return [PSCustomObject]@{
        namespace = [PSCustomObject]@{
            prefix = [string]$source.prefix
            uri    = [string]$source.uri
        }
    }
}

function Resolve-GeoServerTargetWorkspace {
    param(
        [Parameter(Mandatory)][string]$SourceWorkspace,
        [Parameter(Mandatory)][string]$SourceUri,
        [string]$TargetWorkspace,
        [string]$TargetWorkspaceUri
    )

    if ([string]::IsNullOrWhiteSpace($TargetWorkspaceUri) -eq $false -and [string]::IsNullOrWhiteSpace($TargetWorkspace)) {
        throw 'TargetWorkspaceUri requires TargetWorkspace.'
    }

    if ([string]::IsNullOrWhiteSpace($TargetWorkspace)) {
        return [PSCustomObject]@{ name = $SourceWorkspace; uri = $SourceUri }
    }

    $uri = $TargetWorkspaceUri
    if ([string]::IsNullOrWhiteSpace($uri)) {
        $sourceUriWithoutSlash = $SourceUri.TrimEnd('/')
        $sourceSuffix = "/$SourceWorkspace"
        if ($sourceUriWithoutSlash.EndsWith($sourceSuffix, [StringComparison]::OrdinalIgnoreCase)) {
            $uri = $sourceUriWithoutSlash.Substring(0, $sourceUriWithoutSlash.Length - $SourceWorkspace.Length) + $TargetWorkspace
        } else {
            $uri = "$sourceUriWithoutSlash/$TargetWorkspace"
        }
    }

    return [PSCustomObject]@{ name = $TargetWorkspace; uri = $uri }
}

function Resolve-GeoServerTemplate {
    param(
        [Parameter(Mandatory)][string]$Content,
        [Parameter(Mandatory)][hashtable]$Variables
    )

    $resolved = $Content
    $matches = @([regex]::Matches($Content, '\$\{(?<name>[A-Z0-9_]+)\}'))
    foreach ($match in $matches) {
        $name = $match.Groups['name'].Value
        if (-not $Variables.ContainsKey($name) -or [string]::IsNullOrWhiteSpace([string]$Variables[$name])) {
            throw "Missing required GeoServer template variable: $name"
        }
        $resolved = $resolved.Replace($match.Value, [string]$Variables[$name])
    }

    if ([regex]::IsMatch($resolved, '\$\{[A-Z0-9_]+\}')) {
        throw 'Unresolved GeoServer template variables remain in content.'
    }

    return $resolved
}

function New-GeoServerHeaders {
    param(
        [Parameter(Mandatory)][pscredential]$Credential,
        [string]$Accept = 'application/json'
    )

    $pair = '{0}:{1}' -f $Credential.UserName, $Credential.GetNetworkCredential().Password
    $encoded = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
    return @{
        Authorization = "Basic $encoded"
        Accept        = $Accept
    }
}

function Get-GeoServerStatusCode {
    param([Parameter(Mandatory)][System.Management.Automation.ErrorRecord]$ErrorRecord)

    $response = $ErrorRecord.Exception.Response
    if ($null -eq $response) {
        return $null
    }
    return [int]$response.StatusCode
}

function Invoke-GeoServerRestRequest {
    param(
        [Parameter(Mandatory)][string]$Uri,
        [ValidateSet('Get', 'Post', 'Put', 'Delete')][string]$Method = 'Get',
        [Parameter(Mandatory)][hashtable]$Headers,
        [AllowNull()][object]$Body,
        [string]$ContentType,
        [switch]$IgnoreNotFound
    )

    $request = @{
        Uri         = $Uri
        Method      = $Method
        Headers     = $Headers
        ErrorAction = 'Stop'
    }
    if ($PSBoundParameters.ContainsKey('Body')) {
        $request.Body = $Body
    }
    if (-not [string]::IsNullOrWhiteSpace($ContentType)) {
        $request.ContentType = $ContentType
    }

    try {
        return Invoke-RestMethod @request
    }
    catch {
        if ($IgnoreNotFound -and (Get-GeoServerStatusCode -ErrorRecord $_) -eq 404) {
            return $null
        }
        throw
    }
}

function Invoke-GeoServerRawRequest {
    param(
        [Parameter(Mandatory)][string]$Uri,
        [Parameter(Mandatory)][hashtable]$Headers,
        [Parameter(Mandatory)][string]$OutFile
    )

    Invoke-WebRequest -Uri $Uri -Method Get -Headers $Headers -OutFile $OutFile -ErrorAction Stop | Out-Null
}

function Get-GeoServerCollectionItems {
    param(
        [AllowNull()][object]$Response,
        [Parameter(Mandatory)][string]$ContainerName,
        [Parameter(Mandatory)][string]$ItemName
    )

    if ($null -eq $Response) {
        return @()
    }

    $container = $Response.PSObject.Properties[$ContainerName]
    if ($null -eq $container -or $null -eq $container.Value -or $container.Value -is [string]) {
        return @()
    }

    $items = $container.Value.PSObject.Properties[$ItemName]
    if ($null -eq $items -or $null -eq $items.Value -or $items.Value -is [string]) {
        return @()
    }

    return @($items.Value)
}

function Write-GeoServerJson {
    param(
        [Parameter(Mandatory)][object]$Value,
        [Parameter(Mandatory)][string]$Path
    )

    $directory = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($directory)) {
        New-Item -ItemType Directory -Force -Path $directory | Out-Null
    }
    $Value | ConvertTo-Json -Depth 100 | Set-Content -Path $Path -Encoding UTF8
}

function Read-GeoServerJson {
    param([Parameter(Mandatory)][string]$Path)

    return Get-Content -Raw -Encoding UTF8 -Path $Path | ConvertFrom-Json
}

function ConvertTo-GeoServerSafeFileName {
    param([Parameter(Mandatory)][string]$Name)

    return ($Name -replace '[\\/:*?"<>|]', '_')
}

function Get-GeoServerLayerStyleNames {
    param([Parameter(Mandatory)][object]$LayerManifest)

    $names = New-Object System.Collections.Generic.List[string]
    $layer = $LayerManifest.layer
    $defaultStyleProperty = $layer.PSObject.Properties['defaultStyle']
    if ($null -ne $defaultStyleProperty -and $null -ne $defaultStyleProperty.Value -and -not [string]::IsNullOrWhiteSpace([string]$defaultStyleProperty.Value.name)) {
        $names.Add([string]$defaultStyleProperty.Value.name)
    }
    $stylesProperty = $layer.PSObject.Properties['styles']
    if ($null -ne $stylesProperty -and $null -ne $stylesProperty.Value) {
        $styleItemsProperty = $stylesProperty.Value.PSObject.Properties['style']
        $styleItems = if ($null -ne $styleItemsProperty) { @($styleItemsProperty.Value) } else { @() }
        foreach ($style in $styleItems) {
            if (-not [string]::IsNullOrWhiteSpace([string]$style.name)) {
                $names.Add([string]$style.name)
            }
        }
    }
    return @($names | Select-Object -Unique)
}

Export-ModuleMember -Function @(
    'ConvertTo-GeoServerDataStoreTemplate',
    'ConvertTo-GeoServerFeatureTypeManifest',
    'ConvertTo-GeoServerLayerManifest',
    'ConvertTo-GeoServerWorkspaceManifest',
    'ConvertTo-GeoServerNamespaceManifest',
    'Resolve-GeoServerTargetWorkspace',
    'Resolve-GeoServerTemplate',
    'New-GeoServerHeaders',
    'Get-GeoServerStatusCode',
    'Invoke-GeoServerRestRequest',
    'Invoke-GeoServerRawRequest',
    'Get-GeoServerCollectionItems',
    'Write-GeoServerJson',
    'Read-GeoServerJson',
    'ConvertTo-GeoServerSafeFileName',
    'Get-GeoServerLayerStyleNames'
)
