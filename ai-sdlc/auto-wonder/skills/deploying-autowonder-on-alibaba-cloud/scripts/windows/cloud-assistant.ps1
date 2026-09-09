. (Join-Path $PSScriptRoot 'lib.ps1')

function Save-AutoWonderCloudInvocation {
    param([string]$ManifestPath, [string]$InvocationId, [string]$InstanceId, [string]$Operation, [string]$Status)
    if (-not $ManifestPath) { return }
    Update-JsonFileAtomic -Path $ManifestPath -Update {
        param($document)
        if (-not $document['upgrade']) { $document['upgrade'] = @{} }
        $entries = @(Get-ObjectField $document['upgrade'] 'remoteInvocations')
        $matched = @($entries | Where-Object { $_['invocationId'] -eq $InvocationId })
        if ($matched.Count -eq 0) {
            $entry = @{invocationId=$InvocationId;instanceId=$InstanceId;operation=$Operation;submittedAt=[DateTime]::UtcNow.ToString('o')}
            $entries += $entry
        } else { $entry = $matched[0] }
        $entry['status'] = $Status
        $entry['updatedAt'] = [DateTime]::UtcNow.ToString('o')
        $document['upgrade']['remoteInvocations'] = $entries
        return $document
    }
}

function Invoke-AutoWonderCloudCommand {
    param(
        [Parameter(Mandatory)]$ManifestData,
        [Parameter(Mandatory)][string]$InstanceId,
        [Parameter(Mandatory)][string]$Script,
        [int]$TimeoutSeconds = 1800,
        [string]$ManifestPath,
        [string]$Operation = 'cloud-command'
    )
    $profile = 'auto-wonder'
    if ((Get-ObjectField $ManifestData 'cloudProfile') -and [string](Get-ObjectField $ManifestData 'cloudProfile') -ne $profile) {
        throw 'Only the auto-wonder Alibaba Cloud CLI profile is allowed'
    }
    $region = [string]$ManifestData.region
    Import-AliyunCredential -Profile $profile -Region $region
    $submitted = Invoke-AliyunJson -Product 'ecs' -Action 'RunCommand' -Profile $profile -Parameters @{
        RegionId = $region; 'InstanceId.1' = $InstanceId; Type = 'RunShellScript'
        Timeout = $TimeoutSeconds; CommandContent = $Script
    }
    $invokeId = [string](Get-ObjectField $submitted 'InvokeId')
    if (-not $invokeId) { $invokeId = [string](Get-ObjectField $submitted 'InvocationId') }
    if (-not $invokeId) { throw 'Cloud Assistant invocation ID is missing' }
    $record = @{ManifestPath=$ManifestPath;InvocationId=$invokeId;InstanceId=$InstanceId;Operation=$Operation}
    Save-AutoWonderCloudInvocation @record -Status submitted
    $state = 'submitted'
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds + 60)
    try {
        do {
            Start-Sleep -Seconds 2
            $response = Invoke-AliyunJson -Product 'ecs' -Action 'DescribeInvocationResults' -Profile $profile -Parameters @{
                RegionId = $region; InvokeId = $invokeId
            }
            $container = Get-ObjectField (Get-ObjectField $response 'Invocation') 'InvocationResults'
            if ($null -eq $container) { $container = Get-ObjectField $response 'InvocationResults' }
            $results = @(Get-ObjectField $container 'InvocationResult')
            $result = if ($results.Count -gt 0) { $results[0] } else { $null }
            $status = [string](Get-ObjectField $result 'InvocationStatus')
            if (-not $status) { $status = [string](Get-ObjectField $result 'Status') }
            if ($status -in @('Finished', 'Success')) {
                if ($null -eq (Get-ObjectField $result 'ExitCode') -or [int](Get-ObjectField $result 'ExitCode') -ne 0) {
                    $state = 'failed'
                    Save-AutoWonderCloudInvocation @record -Status $state
                    throw 'Cloud Assistant command failed'
                }
                $output = ''
                if (Get-ObjectField $result 'Output') {
                    try { $output = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([string](Get-ObjectField $result 'Output'))) }
                    catch { throw 'Cloud Assistant returned invalid encoded output' }
                }
                $state = 'finished'
                Save-AutoWonderCloudInvocation @record -Status $state
                return [pscustomobject]@{ invocationId = $invokeId; status = 'finished'; output = $output.Trim() }
            }
            if ($status -in @('Failed','PartialFailed','Stopped','TimedOut','Cancelled','Invalid','Aborted','Terminated')) {
                $state = 'failed'
                Save-AutoWonderCloudInvocation @record -Status $state
                throw 'Cloud Assistant invocation reached terminal failure'
            }
        } while ([DateTime]::UtcNow -lt $deadline)
        $state = 'timed-out'
        Save-AutoWonderCloudInvocation @record -Status $state
        throw 'Cloud Assistant invocation timed out'
    } catch {
        if ($state -eq 'submitted') { Save-AutoWonderCloudInvocation @record -Status error }
        throw
    }
}
