[CmdletBinding()]
param([Parameter(Mandatory)][string]$Manifest,[Parameter(Mandatory)][string]$SourceDirectory,[Parameter(Mandatory)][string]$OutputDirectory)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'windows-upgrade-common.ps1')
Protect-CurrentUserFile -Path $Manifest
$resolvedSource=@(& python -B (Join-Path $PSScriptRoot 'upgrade_plan.py') resolve-source --source-dir $SourceDirectory)
if ($LASTEXITCODE -ne 0 -or $resolvedSource.Count -ne 1) { throw 'Target AutoWonder project directory is unavailable' }
$SourceDirectory=[string]$resolvedSource[0]
$data=Refresh-ApprovedUpgradeTargets -Manifest $Manifest
$target=[string]$data.upgrade.toCommit
$planFingerprint=[string]$data.upgrade.planFingerprint
if ($target -notmatch '^[0-9a-f]{40}$') { throw 'Build target must be an exact commit' }
$workspaceContent=($data.upgrade['sourceMode'] -eq 'workspace-current-content')
if ($workspaceContent) {
    $sourceCommit=(& python -B (Join-Path $PSScriptRoot 'upgrade_plan.py') content-identity --source-dir $SourceDirectory).Trim()
    if ($LASTEXITCODE -ne 0 -or $sourceCommit -ne $target) { throw 'Workspace content differs from the approved release identity' }
} else {
    $sourceCommit=(& git -C $SourceDirectory rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $sourceCommit -ne $target) { throw 'Build source is not the exact target commit' }
    $dirty=@(& git -C $SourceDirectory status --porcelain --untracked-files=normal)
    if ($LASTEXITCODE -ne 0 -or $dirty.Count -gt 0) { throw 'Build requires an isolated clean target worktree' }
}
$unit=Join-Path $SourceDirectory 'skills\deploying-autowonder-on-alibaba-cloud\assets\systemd\autowonder.service'
if (-not (Test-Path -LiteralPath $unit -PathType Leaf)) { throw 'Exact target source systemd unit is missing' }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$OutputDirectory=(Resolve-Path -LiteralPath $OutputDirectory).Path
& mvn -f (Join-Path $SourceDirectory 'pom.xml') -B clean package '-DskipFrontend=false' '-DskipTests' '-DskipGitCommitId=true'
if ($LASTEXITCODE -ne 0) { throw 'Native Windows release build failed' }
$jar=@(Get-ChildItem (Join-Path $SourceDirectory 'target') -Filter '*.jar' -File | Where-Object Name -NotMatch 'sources|javadoc|original' | Sort-Object Length -Descending)
if ($jar.Count -eq 0) { throw 'Built JAR is missing' }
$files=@{'auto-wonder.jar'=$jar[0].FullName;'autowonder-schema.sql'=(Join-Path $SourceDirectory 'docs\autowonder-schema.sql');'autowonder-community-templates.sql'=(Join-Path $SourceDirectory 'docs\autowonder-community-templates.sql');'autowonder.service'=$unit}
foreach ($name in $files.Keys) {
    $destination=Join-Path $OutputDirectory $name
    if (Test-Path -LiteralPath $destination) { (Get-Item -LiteralPath $destination).IsReadOnly=$false }
    Copy-Item -LiteralPath $files[$name] -Destination $destination -Force
}
$archive=Join-Path $OutputDirectory 'autowonder-migrations.tar.gz'
$temporary="$archive.tmp-$([Guid]::NewGuid().ToString('N'))"
try {
    & tar -czf $temporary -C (Join-Path $SourceDirectory 'docs') migration
    if ($LASTEXITCODE -ne 0) { throw 'Migration archive build failed' }
    if (Test-Path -LiteralPath $archive) { (Get-Item -LiteralPath $archive).IsReadOnly=$false }
    Move-Item -LiteralPath $temporary -Destination $archive -Force
} finally { if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force } }
$artifacts=@{}
foreach ($name in @('auto-wonder.jar','autowonder-schema.sql','autowonder-community-templates.sql','autowonder-migrations.tar.gz','autowonder.service')) {
    $path=Join-Path $OutputDirectory $name
    $artifacts[$name]=@{sha256=(Get-FileSha256 $path);size=(Get-Item -LiteralPath $path).Length;source='target-source'}
    (Get-Item -LiteralPath $path).IsReadOnly=$true
}
$data=Refresh-ApprovedUpgradeTargets -Manifest $Manifest
if ($data.upgrade.toCommit -ne $target -or $data.upgrade.planFingerprint -ne $planFingerprint) { throw 'Approved target changed during build' }
if ($workspaceContent) {
    $afterBuild=(& python -B (Join-Path $PSScriptRoot 'upgrade_plan.py') content-identity --source-dir $SourceDirectory).Trim()
    if ($LASTEXITCODE -ne 0 -or $afterBuild -ne $target) { throw 'Workspace source changed during build' }
} else {
    $afterBuild=(& git -C $SourceDirectory rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $afterBuild -ne $target) { throw 'Target Git commit changed during build' }
    $dirty=@(& git -C $SourceDirectory status --porcelain --untracked-files=normal)
    if ($LASTEXITCODE -ne 0 -or $dirty.Count -gt 0) { throw 'Target worktree changed during build' }
}
Update-JsonFileAtomic $Manifest {param($document)
    $document.upgrade.release=@{commit=$target;directory=$OutputDirectory;planFingerprint=$document.upgrade.planFingerprint;artifacts=$artifacts;builtAt=[DateTime]::UtcNow.ToString('o')}
    $document.repositoryCommit=$target
    $document.source=@{kind='git';releaseId=$target;gitValidation='required'}
    if ($workspaceContent) { $document.source=@{kind='workspace';releaseId=$target;gitValidation='disabled';contentIdentity='sha256-file-set'} }
    if (-not $document['artifacts']) { $document.artifacts=@{} }
    $document.artifacts.releaseDirectory=$OutputDirectory
    $document.artifacts.jar=@{name='auto-wonder.jar';sha256=$artifacts['auto-wonder.jar'].sha256;size=$artifacts['auto-wonder.jar'].size}
    $document.artifacts.migrations=@{name='autowonder-migrations.tar.gz';sha256=$artifacts['autowonder-migrations.tar.gz'].sha256;size=$artifacts['autowonder-migrations.tar.gz'].size}
    $document.artifacts.systemdUnit=@{name='autowonder.service';sha256=$artifacts['autowonder.service'].sha256;source='target-source'}
    $document.phase='upgrade-build';$document.status='built';$document
}
& python -B (Join-Path $PSScriptRoot 'upgrade_plan.py') seal --manifest $Manifest --source-dir $SourceDirectory
if ($LASTEXITCODE -ne 0) { throw 'Target release baseline sealing failed' }
@{status='built';commit=$target;artifactCount=$artifacts.Count}|ConvertTo-Json -Compress
