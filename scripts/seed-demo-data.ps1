[CmdletBinding()]
param(
    [ValidateNotNullOrEmpty()]
    [string]$ApiBaseUrl = 'http://localhost:8080/api/v1',

    [System.Security.SecureString]$BootstrapAdminPassword,

    [switch]$AllowRemoteTarget
)

$ErrorActionPreference = 'Stop'
$DemoPassword = 'ResolveDeskDemo123!'

function Write-Step {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "`n$Message" -ForegroundColor Cyan
}

function Assert-Condition {
    param(
        [Parameter(Mandatory)][bool]$Condition,
        [Parameter(Mandatory)][string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Convert-SecureStringToPlainText {
    param([Parameter(Mandatory)][System.Security.SecureString]$SecureString)

    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

function Get-ApiErrorDetail {
    param([Parameter(Mandatory)]$ErrorRecord)

    $response = $ErrorRecord.Exception.Response
    if ($null -eq $response) {
        return $ErrorRecord.Exception.Message
    }

    try {
        if ($response -is [System.Net.Http.HttpResponseMessage]) {
            $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        }
        else {
            $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
            try {
                $body = $reader.ReadToEnd()
            }
            finally {
                $reader.Dispose()
            }
        }

        if (-not [string]::IsNullOrWhiteSpace($body)) {
            try {
                $problem = $body | ConvertFrom-Json
                if (-not [string]::IsNullOrWhiteSpace($problem.detail)) {
                    return "HTTP $([int]$response.StatusCode): $($problem.detail)"
                }
            }
            catch {
                # Preserve the response body below when it is not a Problem Details document.
            }
            return "HTTP $([int]$response.StatusCode): $body"
        }

        return "HTTP $([int]$response.StatusCode): $($response.StatusDescription)"
    }
    finally {
        if ($response -is [System.IDisposable]) {
            $response.Dispose()
        }
    }
}

function Invoke-Api {
    param(
        [Parameter(Mandatory)]$Session,
        [Parameter(Mandatory)]
        [ValidateSet('GET', 'POST', 'PATCH', 'PUT', 'DELETE')]
        [string]$Method,
        [Parameter(Mandatory)][string]$Path,
        $Body
    )

    $headers = @{ Accept = 'application/json' }
    if ($Method -ne 'GET') {
        $csrf = Invoke-Api -Session $Session -Method 'GET' -Path '/auth/csrf'
        $headers[$csrf.headerName] = $csrf.token
    }

    $request = @{
        Uri         = "$script:ApiBaseUrl$Path"
        Method      = $Method
        WebSession  = $Session
        Headers     = $headers
        ErrorAction = 'Stop'
    }
    if ($null -ne $Body) {
        $request.Body = $Body | ConvertTo-Json -Depth 8 -Compress
        $request.ContentType = 'application/json'
    }

    try {
        return Invoke-RestMethod @request
    }
    catch {
        $detail = Get-ApiErrorDetail $_
        throw "API $Method $Path failed: $detail"
    }
}

function New-ApiSession {
    return New-Object Microsoft.PowerShell.Commands.WebRequestSession
}

function Login-ApiSession {
    param(
        [Parameter(Mandatory)][string]$Email,
        [Parameter(Mandatory)][string]$Password
    )

    $session = New-ApiSession
    $response = Invoke-Api -Session $session -Method 'POST' -Path '/auth/login' -Body @{
        email = $Email
        password = $Password
    }
    return [pscustomobject]@{
        Session = $session
        User = $response.user
    }
}

function Register-DemoUser {
    param(
        [Parameter(Mandatory)]$Session,
        [Parameter(Mandatory)]$Definition
    )

    return Invoke-Api -Session $Session -Method 'POST' -Path '/auth/register' -Body @{
        firstName = $Definition.FirstName
        lastName = $Definition.LastName
        email = $Definition.Email
        password = $DemoPassword
    }
}

function Get-Ticket {
    param(
        [Parameter(Mandatory)]$AdminSession,
        [Parameter(Mandatory)][long]$TicketId
    )

    return Invoke-Api -Session $AdminSession -Method 'GET' -Path "/tickets/$TicketId"
}

function Set-TicketWorkflow {
    param(
        [Parameter(Mandatory)]$AdminSession,
        [Parameter(Mandatory)]$Ticket,
        [Parameter(Mandatory)]$Definition,
        [Parameter(Mandatory)]$TeamIds,
        [Parameter(Mandatory)]$UsersByEmail,
        [Parameter(Mandatory)][AllowEmptyCollection()][System.Collections.ArrayList]$AwaitingClosure
    )

    $current = Get-Ticket -AdminSession $AdminSession -TicketId $Ticket.id
    $teamMutation = Invoke-Api -Session $AdminSession -Method 'PATCH' -Path "/tickets/$($Ticket.id)/team" -Body @{
        teamId = $TeamIds[$Definition.Team]
        version = $current.version
    }
    $version = $teamMutation.version

    if ($null -ne $Definition.Agent) {
        $assignmentMutation = Invoke-Api -Session $AdminSession -Method 'PATCH' -Path "/tickets/$($Ticket.id)/assignee" -Body @{
            agentId = $UsersByEmail[$Definition.Agent].id
            version = $version
        }
        $version = $assignmentMutation.version
    }

    if ($Definition.Priority -ne 'MEDIUM') {
        $priorityMutation = Invoke-Api -Session $AdminSession -Method 'PATCH' -Path "/tickets/$($Ticket.id)/priority" -Body @{
            priority = $Definition.Priority
            version = $version
        }
        $version = $priorityMutation.version
    }

    switch ($Definition.Status) {
        'OPEN' { return }
        'IN_PROGRESS' {
            Invoke-Api -Session $AdminSession -Method 'PATCH' -Path "/tickets/$($Ticket.id)/status" -Body @{
                status = 'IN_PROGRESS'
                version = $version
            } | Out-Null
            return
        }
        'RESOLVED' {
            $inProgress = Invoke-Api -Session $AdminSession -Method 'PATCH' -Path "/tickets/$($Ticket.id)/status" -Body @{
                status = 'IN_PROGRESS'
                version = $version
            }
            Invoke-Api -Session $AdminSession -Method 'PATCH' -Path "/tickets/$($Ticket.id)/status" -Body @{
                status = 'RESOLVED'
                version = $inProgress.version
            } | Out-Null
            return
        }
        'CLOSED' {
            $inProgress = Invoke-Api -Session $AdminSession -Method 'PATCH' -Path "/tickets/$($Ticket.id)/status" -Body @{
                status = 'IN_PROGRESS'
                version = $version
            }
            $resolved = Invoke-Api -Session $AdminSession -Method 'PATCH' -Path "/tickets/$($Ticket.id)/status" -Body @{
                status = 'RESOLVED'
                version = $inProgress.version
            }
            [void]$AwaitingClosure.Add([pscustomobject]@{ Id = $Ticket.id; Version = $resolved.version })
            return
        }
    }
}

function Add-TicketComment {
    param(
        [Parameter(Mandatory)]$Session,
        [Parameter(Mandatory)][long]$TicketId,
        [Parameter(Mandatory)][string]$Content
    )

    Invoke-Api -Session $Session -Method 'POST' -Path "/tickets/$TicketId/comments" -Body @{ content = $Content } | Out-Null
}

function Test-LocalApiTarget {
    param([Parameter(Mandatory)][string]$Value)

    try {
        $uri = [Uri]$Value
    }
    catch {
        throw "ApiBaseUrl must be an absolute URL ending in /api/v1. Received: $Value"
    }

    Assert-Condition ($uri.IsAbsoluteUri -and $uri.Scheme -in @('http', 'https')) 'ApiBaseUrl must use http or https.'
    Assert-Condition ([string]::IsNullOrWhiteSpace($uri.Query) -and [string]::IsNullOrWhiteSpace($uri.Fragment)) 'ApiBaseUrl must not include a query string or fragment.'
    Assert-Condition ($uri.AbsolutePath.TrimEnd('/') -eq '/api/v1') 'ApiBaseUrl must end in /api/v1.'

    $localHosts = @('localhost', '127.0.0.1', '::1')
    if (-not $AllowRemoteTarget -and $uri.Host.ToLowerInvariant() -notin $localHosts) {
        throw "Refusing non-local API target '$($uri.Host)'. Use -AllowRemoteTarget only when you intentionally want to seed that target."
    }

    $script:ApiBaseUrl = $uri.AbsoluteUri.TrimEnd('/')
}

$agents = @(
    [pscustomobject]@{ FirstName = 'Maya'; LastName = 'Chen'; Email = 'maya.chen@example.test' },
    [pscustomobject]@{ FirstName = 'Daniel'; LastName = 'Brooks'; Email = 'daniel.brooks@example.test' },
    [pscustomobject]@{ FirstName = 'Priya'; LastName = 'Shah'; Email = 'priya.shah@example.test' },
    [pscustomobject]@{ FirstName = 'Leo'; LastName = 'Martin'; Email = 'leo.martin@example.test' }
)

$customers = @(
    [pscustomobject]@{ FirstName = 'Elena'; LastName = 'Rossi'; Email = 'elena.rossi@example.test' },
    [pscustomobject]@{ FirstName = 'Marcus'; LastName = 'Lee'; Email = 'marcus.lee@example.test' },
    [pscustomobject]@{ FirstName = 'Nina'; LastName = 'Patel'; Email = 'nina.patel@example.test' },
    [pscustomobject]@{ FirstName = 'Jordan'; LastName = 'Kim'; Email = 'jordan.kim@example.test' }
)

$teamDefinitions = @(
    [pscustomobject]@{ Name = 'Platform Support'; Members = @('maya.chen@example.test', 'daniel.brooks@example.test', 'priya.shah@example.test'); Active = $true },
    [pscustomobject]@{ Name = 'Billing Operations'; Members = @('priya.shah@example.test', 'leo.martin@example.test'); Active = $true },
    [pscustomobject]@{ Name = 'Customer Success'; Members = @('daniel.brooks@example.test', 'leo.martin@example.test'); Active = $true },
    [pscustomobject]@{ Name = 'Legacy Escalations'; Members = @(); Active = $false }
)

$ticketDefinitions = @(
    [pscustomobject]@{ Reference = 'SUP-1'; Customer = 'elena.rossi@example.test'; Title = 'SSO sign-in fails after domain verification'; Description = 'Our team completed domain verification this morning, and managed users are now redirected back to the sign-in screen after SSO. Password sign-in continues to work.'; Priority = 'HIGH'; Status = 'IN_PROGRESS'; Team = 'Platform Support'; Agent = 'maya.chen@example.test' },
    [pscustomobject]@{ Reference = 'SUP-2'; Customer = 'elena.rossi@example.test'; Title = 'CSV export stalls on large reports'; Description = 'Exporting the monthly usage report stalls after the progress indicator reaches roughly 80 percent. Smaller reports complete normally.'; Priority = 'MEDIUM'; Status = 'OPEN'; Team = 'Platform Support'; Agent = $null },
    [pscustomobject]@{ Reference = 'SUP-3'; Customer = 'elena.rossi@example.test'; Title = 'Need invoice copy for August'; Description = 'Please provide a copy of the finalized August invoice for our finance archive. The billing portal currently shows only the September statement.'; Priority = 'LOW'; Status = 'RESOLVED'; Team = 'Billing Operations'; Agent = 'leo.martin@example.test' },
    [pscustomobject]@{ Reference = 'SUP-4'; Customer = 'elena.rossi@example.test'; Title = 'Update billing contact before renewal'; Description = 'Our procurement contact has changed ahead of the upcoming renewal. We need the renewal notices sent to the new billing contact.'; Priority = 'MEDIUM'; Status = 'CLOSED'; Team = 'Customer Success'; Agent = 'daniel.brooks@example.test' },
    [pscustomobject]@{ Reference = 'SUP-5'; Customer = 'marcus.lee@example.test'; Title = 'Duplicate charge on September invoice'; Description = 'The September invoice appears to include the same subscription charge twice. Please confirm which charge will be reversed and when.'; Priority = 'HIGH'; Status = 'IN_PROGRESS'; Team = 'Billing Operations'; Agent = 'priya.shah@example.test' },
    [pscustomobject]@{ Reference = 'SUP-6'; Customer = 'marcus.lee@example.test'; Title = 'Workspace members cannot reset passwords'; Description = 'Several workspace members request password resets but do not receive the reset flow after following the link in the email.'; Priority = 'URGENT'; Status = 'OPEN'; Team = 'Platform Support'; Agent = $null },
    [pscustomobject]@{ Reference = 'SUP-7'; Customer = 'nina.patel@example.test'; Title = 'API requests return intermittent 502 errors'; Description = 'Our integration receives intermittent 502 responses from the reporting endpoint during normal business hours. Retries usually succeed within a few minutes.'; Priority = 'URGENT'; Status = 'IN_PROGRESS'; Team = 'Platform Support'; Agent = 'daniel.brooks@example.test' },
    [pscustomobject]@{ Reference = 'SUP-8'; Customer = 'nina.patel@example.test'; Title = 'Incorrect tax address on invoice'; Description = 'The latest invoice shows our previous tax address even though the workspace profile was updated before the billing period closed.'; Priority = 'MEDIUM'; Status = 'RESOLVED'; Team = 'Billing Operations'; Agent = 'leo.martin@example.test' },
    [pscustomobject]@{ Reference = 'SUP-9'; Customer = 'nina.patel@example.test'; Title = 'Remove former admin from workspace'; Description = 'A former administrator no longer works with our company and should not retain access to the workspace administration area.'; Priority = 'LOW'; Status = 'CLOSED'; Team = 'Customer Success'; Agent = 'daniel.brooks@example.test' },
    [pscustomobject]@{ Reference = 'SUP-10'; Customer = 'jordan.kim@example.test'; Title = 'Invite emails not reaching new users'; Description = 'New invitees are not receiving their workspace invitation emails, including after checking spam folders and retrying the invitation.'; Priority = 'HIGH'; Status = 'OPEN'; Team = 'Platform Support'; Agent = 'maya.chen@example.test' },
    [pscustomobject]@{ Reference = 'SUP-11'; Customer = 'jordan.kim@example.test'; Title = 'Renewal confirmation not received'; Description = 'Our renewal completed successfully, but the confirmation email and receipt have not arrived for our records.'; Priority = 'MEDIUM'; Status = 'RESOLVED'; Team = 'Customer Success'; Agent = 'leo.martin@example.test' },
    [pscustomobject]@{ Reference = 'SUP-12'; Customer = 'jordan.kim@example.test'; Title = 'Audit log export missing timestamps'; Description = 'The audit log export contains the expected events, but the timestamp column is blank for each row in the downloaded file.'; Priority = 'MEDIUM'; Status = 'CLOSED'; Team = 'Platform Support'; Agent = 'priya.shah@example.test' }
)

$commentDefinitions = @(
    [pscustomobject]@{ Reference = 'SUP-1'; Author = 'elena.rossi@example.test'; Content = "Our team completed domain verification this morning. Since then, SSO redirects back to the sign-in screen for all managed users. Password login still works." },
    [pscustomobject]@{ Reference = 'SUP-1'; Author = 'maya.chen@example.test'; Content = "Thanks, Elena. I can reproduce this against the SAML configuration. I'm checking the assertion audience and ACS URL now." },
    [pscustomobject]@{ Reference = 'SUP-1'; Author = 'elena.rossi@example.test'; Content = "I've confirmed the IdP metadata hasn't changed on our side. The issue currently affects 23 users." },
    [pscustomobject]@{ Reference = 'SUP-1'; Author = 'maya.chen@example.test'; Content = "I found a mismatch in the workspace SSO configuration after verification. I've corrected it and I'm validating sign-in with a test account." },
    [pscustomobject]@{ Reference = 'SUP-5'; Author = 'marcus.lee@example.test'; Content = 'The duplicate line item is for the same annual plan and amount. Our finance team has paused payment while we confirm the correction.' },
    [pscustomobject]@{ Reference = 'SUP-5'; Author = 'priya.shah@example.test'; Content = 'I have matched the duplicate charge to the September renewal run and am coordinating the reversal with Billing.' },
    [pscustomobject]@{ Reference = 'SUP-8'; Author = 'nina.patel@example.test'; Content = 'The correct tax address is visible in our workspace settings, so please use that address for the revised invoice.' },
    [pscustomobject]@{ Reference = 'SUP-8'; Author = 'leo.martin@example.test'; Content = 'I corrected the billing profile and issued a revised invoice with the updated tax address.' },
    [pscustomobject]@{ Reference = 'SUP-10'; Author = 'jordan.kim@example.test'; Content = 'We have retried two invitations this afternoon and neither recipient received an email.' },
    [pscustomobject]@{ Reference = 'SUP-10'; Author = 'maya.chen@example.test'; Content = 'I am reviewing the invitation delivery records and will update this ticket once the affected messages are traced.' }
)

Test-LocalApiTarget -Value $ApiBaseUrl

if ($null -eq $BootstrapAdminPassword) {
    if (-not [string]::IsNullOrWhiteSpace($env:RESOLVEDESK_BOOTSTRAP_ADMIN_PASSWORD)) {
        $BootstrapAdminPassword = ConvertTo-SecureString $env:RESOLVEDESK_BOOTSTRAP_ADMIN_PASSWORD -AsPlainText -Force
    }
    else {
        $BootstrapAdminPassword = Read-Host 'Bootstrap ADMIN password' -AsSecureString
    }
}

$bootstrapPassword = Convert-SecureStringToPlainText $BootstrapAdminPassword
try {
    Write-Step 'Checking the local ResolveDesk API and fresh dataset...'
    $adminContext = Login-ApiSession -Email 'alex.morgan@example.test' -Password $bootstrapPassword
    Assert-Condition ($adminContext.User.role -eq 'ADMIN') 'The bootstrap account must have the ADMIN role.'
    Assert-Condition ($adminContext.User.firstName -eq 'Alex' -and $adminContext.User.lastName -eq 'Morgan') 'The bootstrap ADMIN must be Alex Morgan for this deterministic demo dataset.'

    $existingUsers = Invoke-Api -Session $adminContext.Session -Method 'GET' -Path '/users?size=100&sort=createdAt,asc'
    $existingTickets = Invoke-Api -Session $adminContext.Session -Method 'GET' -Path '/tickets?size=1'
    $existingTeams = Invoke-Api -Session $adminContext.Session -Method 'GET' -Path '/teams?includeInactive=true'
    Assert-Condition ($existingUsers.totalElements -eq 1) 'Refusing to seed: expected only the bootstrap ADMIN user in a fresh database.'
    Assert-Condition ($existingTickets.totalElements -eq 0) 'Refusing to seed: tickets already exist. Reset the local demo database deliberately before retrying.'
    Assert-Condition ($existingTeams.Count -eq 0) 'Refusing to seed: teams already exist. Reset the local demo database deliberately before retrying.'

    Write-Step 'Creating users...'
    $registrationSession = New-ApiSession
    $usersByEmail = @{}
    foreach ($definition in ($agents + $customers)) {
        $created = Register-DemoUser -Session $registrationSession -Definition $definition
        $usersByEmail[$created.email] = $created
    }
    foreach ($agent in $agents) {
        $updated = Invoke-Api -Session $adminContext.Session -Method 'PATCH' -Path "/users/$($usersByEmail[$agent.Email].id)/role" -Body @{ role = 'AGENT' }
        $usersByEmail[$updated.email] = $updated
    }

    $customerSessions = @{}
    foreach ($customer in $customers) {
        $customerSessions[$customer.Email] = Login-ApiSession -Email $customer.Email -Password $DemoPassword
    }
    $agentSessions = @{}
    foreach ($agent in $agents) {
        $agentSessions[$agent.Email] = Login-ApiSession -Email $agent.Email -Password $DemoPassword
    }

    Write-Step 'Creating teams...'
    $teamIds = @{}
    foreach ($team in $teamDefinitions) {
        $createdTeam = Invoke-Api -Session $adminContext.Session -Method 'POST' -Path '/teams' -Body @{ name = $team.Name }
        $teamIds[$team.Name] = $createdTeam.id
    }

    Write-Step 'Assigning memberships...'
    foreach ($team in $teamDefinitions) {
        foreach ($memberEmail in $team.Members) {
            Invoke-Api -Session $adminContext.Session -Method 'PUT' -Path "/teams/$($teamIds[$team.Name])/members/$($usersByEmail[$memberEmail].id)" | Out-Null
        }
        if (-not $team.Active) {
            Invoke-Api -Session $adminContext.Session -Method 'PATCH' -Path "/teams/$($teamIds[$team.Name])/active" -Body @{ active = $false } | Out-Null
        }
    }

    Write-Step 'Creating tickets...'
    $ticketsByReference = @{}
    foreach ($definition in $ticketDefinitions) {
        $createdTicket = Invoke-Api -Session $customerSessions[$definition.Customer].Session -Method 'POST' -Path '/tickets' -Body @{
            title = $definition.Title
            description = $definition.Description
        }
        Assert-Condition ($createdTicket.reference -eq $definition.Reference) "Expected $($definition.Reference), but the API created $($createdTicket.reference). The database is not a fresh deterministic dataset."
        $ticketsByReference[$definition.Reference] = $createdTicket
    }

    Write-Step 'Building ticket workflows...'
    $awaitingClosure = New-Object System.Collections.ArrayList
    foreach ($definition in $ticketDefinitions) {
        Set-TicketWorkflow -AdminSession $adminContext.Session -Ticket $ticketsByReference[$definition.Reference] -Definition $definition -TeamIds $teamIds -UsersByEmail $usersByEmail -AwaitingClosure $awaitingClosure
    }

    Write-Step 'Adding demo conversations...'
    foreach ($comment in $commentDefinitions) {
        $session = if ($customerSessions.ContainsKey($comment.Author)) { $customerSessions[$comment.Author].Session } else { $agentSessions[$comment.Author].Session }
        Add-TicketComment -Session $session -TicketId $ticketsByReference[$comment.Reference].id -Content $comment.Content
    }

    if ($awaitingClosure.Count -gt 0) {
        Write-Step 'Finalizing closed ticket lifecycles...'
        foreach ($pendingClosure in $awaitingClosure) {
            $current = Get-Ticket -AdminSession $adminContext.Session -TicketId $pendingClosure.Id
            Assert-Condition ($current.status -eq 'RESOLVED') "Ticket $($current.reference) must be resolved before closure."
            Invoke-Api -Session $adminContext.Session -Method 'PATCH' -Path "/tickets/$($pendingClosure.Id)/status" -Body @{
                status = 'CLOSED'
                version = $current.version
            } | Out-Null
        }
    }

    Write-Step 'Verifying the final demo dataset...'
    $finalTickets = Invoke-Api -Session $adminContext.Session -Method 'GET' -Path '/tickets?size=100&sort=createdAt,asc'
    Assert-Condition ($finalTickets.totalElements -eq 12) 'Verification failed: expected exactly 12 tickets.'
    foreach ($definition in $ticketDefinitions) {
        $ticket = Get-Ticket -AdminSession $adminContext.Session -TicketId $ticketsByReference[$definition.Reference].id
        Assert-Condition ($ticket.reference -eq $definition.Reference) "Verification failed: unexpected ticket reference for $($definition.Title)."
        Assert-Condition ($ticket.status -eq $definition.Status -and $ticket.priority -eq $definition.Priority) "Verification failed: $($definition.Reference) does not have its requested status and priority."
        Assert-Condition ($ticket.assignedTeam.name -eq $definition.Team) "Verification failed: $($definition.Reference) is not routed to $($definition.Team)."
        if ($null -eq $definition.Agent) {
            Assert-Condition ($null -eq $ticket.assignedAgent) "Verification failed: $($definition.Reference) should be unassigned."
        }
        else {
            Assert-Condition ($ticket.assignedAgent.id -eq $usersByEmail[$definition.Agent].id) "Verification failed: $($definition.Reference) has the wrong assigned agent."
        }
    }
    $legacyTeam = Invoke-Api -Session $adminContext.Session -Method 'GET' -Path "/teams/$($teamIds['Legacy Escalations'])"
    Assert-Condition (-not $legacyTeam.active -and $legacyTeam.members.Count -eq 0) 'Verification failed: Legacy Escalations must be inactive and have no members.'
    $showcaseComments = Invoke-Api -Session $adminContext.Session -Method 'GET' -Path "/tickets/$($ticketsByReference['SUP-1'].id)/comments?size=50"
    Assert-Condition ($showcaseComments.totalElements -eq 4) 'Verification failed: SUP-1 must contain its four-message showcase conversation.'

    Write-Host "`nDemo data ready." -ForegroundColor Green
    Write-Host 'ADMIN:     alex.morgan@example.test (uses the bootstrap password you supplied)'
    Write-Host "AGENTS:    $($agents.Email -join ', ')"
    Write-Host "CUSTOMERS: $($customers.Email -join ', ')"
    Write-Host "Shared non-admin demo password: $DemoPassword"
}
finally {
    $bootstrapPassword = $null
}
