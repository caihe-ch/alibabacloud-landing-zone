#requires -Version 5.1
[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$Manifest)

$ErrorActionPreference = 'Stop'
$DeploySkill = Join-Path $PSScriptRoot '..\..\deploying-autowonder-on-alibaba-cloud'
. (Join-Path $DeploySkill 'scripts\windows\lib.ps1')

$data = Get-ManifestData -Manifest $Manifest
function Assert-NoSecretField($Value) {
    if ($null -eq $Value -or $Value -is [string] -or $Value -is [ValueType]) { return }
    if ($Value -is [System.Collections.IDictionary]) {
        foreach ($key in $Value.Keys) {
            $normalized = ([string]$key).ToLowerInvariant() -replace '[-_.]', ''
            if ($normalized -match '^(?:password|secret|accesskey|accesskeyid|accesskeysecret|masterkey|jwtsecret|presignedurl|executortoken)$') {
                throw 'Manifest contains a forbidden secret-bearing field'
            }
            Assert-NoSecretField $Value[$key]
        }
    } else {
        foreach ($child in $Value) { Assert-NoSecretField $child }
    }
}
Assert-NoSecretField $data
$profile = 'auto-wonder'
if ($data['cloudProfile'] -and $data['cloudProfile'] -ne $profile) { throw 'Only the auto-wonder Alibaba Cloud CLI profile is allowed' }
$region = [string]$data['region']
$deploymentId = [string]$data['deploymentId']
if (-not $region -or -not $deploymentId) { throw 'Manifest region or deploymentId is missing' }
Ensure-AutoWonderAliyunProfile -Region $region -ExpectedAccountId ([string]$data['accountId']) | Out-Null
$instanceIds = @(Get-ManifestInstanceIds $data)
if ($instanceIds.Count -eq 0) { throw 'ECS inventory is empty' }
$verificationMode = [string](Get-ObjectField $data['upgradeInfo'] 'tagVerificationMode')
if (-not $verificationMode) { $verificationMode = 'strict' }
if ($verificationMode -notin @('strict', 'identity-only')) { throw 'Unknown target tag verification mode' }
$resources = $data['resources']
$expectedVpc = [string]$resources['vpc_id']
$tagSource = $resources['expected_tags']
if ($null -eq $tagSource) { $tagSource = $data['tags'] }
$expectedTags = @{}
if ($tagSource) { foreach ($key in $tagSource.Keys) { $expectedTags[$key] = [string]$tagSource[$key] } }
$expectedTags['Project'] = 'AutoWonder'
$expectedTags['DeploymentId'] = $deploymentId
$expectedTags['ManagedBy'] = 'Terraform'
if (-not $expectedTags['Environment']) { throw 'Manifest Environment tag is missing' }
if (-not $expectedTags['Topology']) { throw 'Manifest Topology tag is missing' }

$verified = @()
foreach ($instanceId in $instanceIds) {
    $response = Invoke-AliyunJson -Product 'ecs' -Action 'DescribeInstances' -Profile $profile -Parameters @{
        RegionId = $region; InstanceIds = (ConvertTo-Json -InputObject @($instanceId) -Compress)
    }
    $instances = @(Get-ObjectField (Get-ObjectField $response 'Instances') 'Instance')
    if ($instances.Count -ne 1 -or $null -eq $instances[0]) { throw 'ECS target identity mismatch' }
    $instance = $instances[0]
    if ([string]$instance['InstanceId'] -ne $instanceId) { throw 'ECS target identity mismatch' }
    $liveRegion = [string]$instance['RegionId']
    if ($liveRegion -and $liveRegion -ne $region) { throw 'ECS target region mismatch' }
    $liveVpc = [string](Get-ObjectField $instance['VpcAttributes'] 'VpcId')
    if ($expectedVpc -and $liveVpc -ne $expectedVpc) { throw 'ECS target VPC mismatch' }
    $liveTags = @{}
    foreach ($tag in @(Get-ObjectField $instance['Tags'] 'Tag')) {
        if ($null -ne $tag) { $liveTags[[string]$tag['TagKey']] = [string]$tag['TagValue'] }
    }
    if ($verificationMode -ne 'identity-only') {
        foreach ($key in $expectedTags.Keys) {
            if ($liveTags[$key] -ne $expectedTags[$key]) { throw 'ECS target tags do not match the deployment manifest' }
        }
    }
    $verified += @{ instanceId = $instanceId; vpcId = $liveVpc }
}

$cloudInstanceIds = @($instanceIds)
if ($verificationMode -ne 'identity-only') {
    $cloudInstanceIds = @()
    $page = 1
    do {
        $response = Invoke-AliyunJson -Product 'ecs' -Action 'DescribeInstances' -Profile $profile -Parameters @{
            RegionId = $region; PageNumber = $page; PageSize = 100
            'Tag.1.Key' = 'Project'; 'Tag.1.Value' = 'AutoWonder'
            'Tag.2.Key' = 'DeploymentId'; 'Tag.2.Value' = $deploymentId
        }
        $pageIds = @(Get-ObjectField (Get-ObjectField $response 'Instances') 'Instance' | ForEach-Object { [string]$_['InstanceId'] } | Where-Object { $_ })
        $cloudInstanceIds = @($cloudInstanceIds + $pageIds | Sort-Object -Unique)
        $total = if ($response['TotalCount']) { [int]$response['TotalCount'] } else { $cloudInstanceIds.Count }
        $page += 1
    } while ($cloudInstanceIds.Count -lt $total -and $pageIds.Count -eq 100)
    if ($cloudInstanceIds.Count -eq 0 -or @(Compare-Object $instanceIds $cloudInstanceIds).Count -ne 0) {
        throw 'Alibaba Cloud ECS nodes differ from Terraform inventory'
    }
}

if ($null -eq $data['upgrade']) { $data['upgrade'] = @{} }
$checkpoint = @{
    status = 'verified'; nodes = $verified
    terraformInstanceIds = $instanceIds; cloudInstanceIds = $cloudInstanceIds
    verifiedAt = [DateTime]::UtcNow.ToString('o')
    verifiedEpoch = ([DateTime]::UtcNow - [DateTime]::SpecifyKind([DateTime]'1970-01-01', [DateTimeKind]::Utc)).TotalSeconds
}
$data['upgrade']['targetVerification'] = $checkpoint
$fingerprint = Get-UpgradeFingerprint -ManifestData $data -Kind target-fingerprint
$checkpoint['fingerprint'] = $fingerprint
$resourceSetFingerprint = [string](Get-ObjectField $data['upgradeInfo'] 'resourceSetFingerprint')
if (-not $resourceSetFingerprint) { $resourceSetFingerprint = $fingerprint }
$checkpoint['resourceSetFingerprint'] = $resourceSetFingerprint
Write-AtomicJson -Path $Manifest -Value $data

@{ status = 'verified'; deploymentId = $deploymentId; region = $region; nodes = $verified
   fingerprint = $fingerprint; resourceSetFingerprint = $resourceSetFingerprint } | ConvertTo-Json -Depth 10 -Compress
