$modulePath = Join-Path $PSScriptRoot '..\lib\GeoServerConfig.psm1'

Describe 'GeoServer catalog configuration helpers' {
    BeforeEach {
        Remove-Module GeoServerConfig -ErrorAction SilentlyContinue
        Import-Module $modulePath -Force
    }

    It 'replaces datastore connection details with portable placeholders' {
        $source = [PSCustomObject]@{
            dataStore = [PSCustomObject]@{
                name = 'pg-webgistest'
                type = 'PostGIS'
                enabled = $true
                workspace = [PSCustomObject]@{
                    name = 'webgistest'
                    href = 'http://source/rest/workspaces/webgistest.json'
                }
                connectionParameters = [PSCustomObject]@{
                    entry = @(
                        [PSCustomObject]@{ '@key' = 'host'; '$' = 'localhost' },
                        [PSCustomObject]@{ '@key' = 'port'; '$' = '5432' },
                        [PSCustomObject]@{ '@key' = 'database'; '$' = 'webgistest' },
                        [PSCustomObject]@{ '@key' = 'user'; '$' = 'postgres' },
                        [PSCustomObject]@{ '@key' = 'passwd'; '$' = 'crypt1:secret' },
                        [PSCustomObject]@{ '@key' = 'schema'; '$' = 'public' }
                    )
                }
                dateCreated = '2026-08-03T00:00:00Z'
                featureTypes = 'http://source/rest/featuretypes.json'
            }
        }

        $template = ConvertTo-GeoServerDataStoreTemplate -DataStore $source
        $entries = @($template.dataStore.connectionParameters.entry)

        ($entries | Where-Object { $_.'@key' -eq 'host' }).'$' | Should Be '${GEOSERVER_DATASTORE_HOST}'
        ($entries | Where-Object { $_.'@key' -eq 'passwd' }).'$' | Should Be '${GEOSERVER_DATASTORE_PASSWORD}'
        $template.dataStore.workspace.PSObject.Properties.Match('href').Count | Should Be 0
        $template.dataStore.PSObject.Properties.Match('dateCreated').Count | Should Be 0
        $template.dataStore.PSObject.Properties.Match('featureTypes').Count | Should Be 0
    }

    It 'keeps only portable feature type fields' {
        $source = [PSCustomObject]@{
            featureType = [PSCustomObject]@{
                name = 'shenzhen_roads'
                nativeName = 'shenzhen_roads'
                title = 'Roads'
                srs = 'EPSG:4326'
                projectionPolicy = 'NONE'
                enabled = $true
                namespace = [PSCustomObject]@{ name = 'webgistest'; href = 'http://source/rest/namespaces/webgistest.json' }
                store = [PSCustomObject]@{ name = 'webgistest:pg-webgistest'; href = 'http://source/rest/store.json' }
                attributes = [PSCustomObject]@{ attribute = @() }
                nativeCRS = 'GEOGCS[...]'
            }
        }

        $manifest = ConvertTo-GeoServerFeatureTypeManifest -FeatureType $source

        $manifest.featureType.name | Should Be 'shenzhen_roads'
        $manifest.featureType.srs | Should Be 'EPSG:4326'
        $manifest.featureType.PSObject.Properties.Match('namespace').Count | Should Be 0
        $manifest.featureType.PSObject.Properties.Match('store').Count | Should Be 0
        $manifest.featureType.PSObject.Properties.Match('attributes').Count | Should Be 0
        $manifest.featureType.PSObject.Properties.Match('nativeCRS').Count | Should Be 0
    }

    It 'keeps layer presentation settings but removes its server resource link' {
        $source = [PSCustomObject]@{
            layer = [PSCustomObject]@{
                name = 'shenzhen_roads'
                enabled = $true
                defaultStyle = [PSCustomObject]@{ name = 'generic'; href = 'http://source/rest/styles/generic.json' }
                resource = [PSCustomObject]@{ name = 'webgistest:shenzhen_roads'; href = 'http://source/rest/featuretypes/shenzhen_roads.json' }
                dateCreated = '2026-08-03T00:00:00Z'
            }
        }

        $manifest = ConvertTo-GeoServerLayerManifest -Layer $source

        $manifest.layer.defaultStyle.name | Should Be 'generic'
        $manifest.layer.defaultStyle.PSObject.Properties.Match('href').Count | Should Be 0
        $manifest.layer.PSObject.Properties.Match('resource').Count | Should Be 0
        $manifest.layer.PSObject.Properties.Match('dateCreated').Count | Should Be 0
    }

    It 'resolves all template variables and rejects unresolved placeholders' {
        $resolved = Resolve-GeoServerTemplate -Content '{"host":"${GEOSERVER_DATASTORE_HOST}"}' -Variables @{ GEOSERVER_DATASTORE_HOST = 'db.internal' }
        $resolved | Should Match 'db.internal'

        { Resolve-GeoServerTemplate -Content '${GEOSERVER_DATASTORE_PASSWORD}' -Variables @{} } | Should Throw
    }

    It 'derives an isolated namespace for a local workspace copy' {
        $target = Resolve-GeoServerTargetWorkspace `
            -SourceWorkspace 'webgistest' `
            -SourceUri 'http://www.openplans.org/webgistest' `
            -TargetWorkspace 'webgistest_copy'

        $target.name | Should Be 'webgistest_copy'
        $target.uri | Should Be 'http://www.openplans.org/webgistest_copy'
    }
}

Describe 'GeoServer catalog script entry points' {
    $geoServerRoot = Split-Path -Parent $PSScriptRoot

    It 'ships export and apply scripts' {
        foreach ($scriptName in @('export.ps1', 'apply.ps1')) {
            Test-Path (Join-Path $geoServerRoot $scriptName) | Should Be $true
        }
    }

    It 'keeps entry point scripts syntactically valid' {
        foreach ($scriptName in @('export.ps1', 'apply.ps1')) {
            $tokens = $null
            $errors = $null
            [System.Management.Automation.Language.Parser]::ParseFile(
                (Join-Path $geoServerRoot $scriptName),
                [ref]$tokens,
                [ref]$errors
            ) | Out-Null
            @($errors).Count | Should Be 0
        }
    }

    It 'does not require a layer to exist during a WhatIf copy preview' {
        $applyScript = Get-Content -Raw (Join-Path $geoServerRoot 'apply.ps1')
        $applyScript | Should Match '\-not \$WhatIfPreference'
        $applyScript | Should Match '\[string\]\$TargetWorkspace'
    }

    It 'builds the style creation URL without extending the PowerShell variable name' {
        $applyScript = Get-Content -Raw (Join-Path $geoServerRoot 'apply.ps1')
        $applyScript | Should Match '\$\{collectionUri\}\?name='
    }
}
