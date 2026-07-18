[CmdletBinding()]
param(
    [switch]$Remove,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
$GnosysOrigin = 'https://rorrimaesu.github.io'
$PolicyPaths = @(
    'HKCU:\Software\Policies\Microsoft\Edge\LoopbackNetworkAllowedForUrls'
)
$PreviousPolicyPaths = @(
    'HKCU:\Software\Policies\Microsoft\Edge\LocalNetworkAccessAllowedForUrls'
)

function Get-NumberedPolicyValues {
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return @()
    }
    $properties = (Get-ItemProperty -LiteralPath $Path).PSObject.Properties
    return @($properties | Where-Object { $_.Name -match '^\d+$' })
}

try {
    $policyChanged = $false
    $pathsToProcess = if ($Remove) { @($PolicyPaths + $PreviousPolicyPaths) } else { $PolicyPaths }

    if (-not $Remove) {
        # Earlier Gnosys builds used Edge's broader local-network policy. Remove
        # only our exact origin from it now that Edge 146+ has a loopback-only
        # policy; preserve every other value in the key.
        foreach ($previousPolicyPath in $PreviousPolicyPaths) {
            foreach ($property in @(Get-NumberedPolicyValues -Path $previousPolicyPath)) {
                if ([string]$property.Value -eq $GnosysOrigin) {
                    Remove-ItemProperty -LiteralPath $previousPolicyPath -Name $property.Name
                    $policyChanged = $true
                }
            }
        }
    }

    foreach ($policyPath in $pathsToProcess) {
        if ($Remove) {
            foreach ($property in @(Get-NumberedPolicyValues -Path $policyPath)) {
                if ([string]$property.Value -eq $GnosysOrigin) {
                    Remove-ItemProperty -LiteralPath $policyPath -Name $property.Name
                    $policyChanged = $true
                }
            }
            continue
        }

        if (-not (Test-Path -LiteralPath $policyPath)) {
            New-Item -Path $policyPath -Force | Out-Null
        }
        $values = @(Get-NumberedPolicyValues -Path $policyPath)
        $matchingValues = @($values | Where-Object { [string]$_.Value -eq $GnosysOrigin })
        if ($matchingValues.Count -gt 0) {
            continue
        }

        $usedSlots = @($values | ForEach-Object { [int]$_.Name })
        $slot = 1
        while ($usedSlots -contains $slot) { $slot++ }
        New-ItemProperty -LiteralPath $policyPath -Name ([string]$slot) -Value $GnosysOrigin -PropertyType String -Force | Out-Null
        $policyChanged = $true
    }

    if (-not $Quiet) {
        if ($Remove) {
            if ($policyChanged) {
                Write-Host '[Gnosys AI] Removed the Microsoft Edge loopback exception for GitHub Pages.' -ForegroundColor Yellow
            } else {
                Write-Host '[Gnosys AI] No Gnosys Edge loopback exception was installed.'
            }
        } elseif ($policyChanged) {
            Write-Host '[Gnosys AI] Allowed the Gnosys GitHub Pages origin to reach the local AI helper in Microsoft Edge.' -ForegroundColor Green
            Write-Host '[Gnosys AI] If Edge is already open, close and reopen it once to refresh browser policy.'
        } else {
            Write-Host '[Gnosys AI] Microsoft Edge loopback access is already configured.' -ForegroundColor Green
        }
    }
    exit 0
} catch {
    Write-Error "Unable to configure Microsoft Edge loopback access: $($_.Exception.Message)"
    exit 1
}
