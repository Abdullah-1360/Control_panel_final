# WP Healer - Extensive Diagnosis & Hierarchical Subdomain Display Implementation Plan

## Date: February 16, 2026

## Overview
This document outlines the implementation plan for two major features:
1. Extensive auto diagnosis with 12 comprehensive checks
2. Hierarchical subdomain display in frontend

## Part 1: Extensive Auto Diagnosis

### Requirements
- Run 12 comprehensive checks in parallel for speed
- Display command outputs when diagnosis completes
- Keep diagnosis fast (target: <10 seconds)
- Store all command outputs for review

### 12 Diagnostic Checks

1. **WordPress Core Integrity Check**
   - Command: `wp core verify-checksums`
   - Checks: Core files not modified/corrupted
   - Time: ~2s

2. **Plugin/Theme Error Scanning**
   - Command: `grep -i "plugin\|theme" wp-content/debug.log | tail -20`
   - Checks: Plugin/theme faults
   - Time: ~1s

3. **Database Connection Test**
   - Command: `wp db check`
   - Checks: Database connectivity and health
   - Time: ~2s

4. **PHP Error Log Analysis (last 100 lines)**
   - Command: `tail -100 wp-content/debug.log`
   - Checks: Fatal errors, warnings, notices
   - Time: ~1s

5. **Apache/Nginx Error Log Analysis**
   - Command: `tail -100 /var/log/apache2/error.log || tail -100 /var/log/httpd/error_log`
   - Checks: Server-level errors
   - Time: ~1s

6. **Disk Space Check**
   - Command: `df -h ${sitePath} | tail -1`
   - Checks: Available disk space
   - Time: <1s

7. **File Permissions Check (wp-content, uploads)**
   - Command: `ls -ld wp-content wp-content/uploads`
   - Checks: Correct permissions (755/775)
   - Time: <1s

8. **.htaccess Validation**
   - Command: `test -f .htaccess && cat .htaccess | head -20`
   - Checks: File exists and contains WordPress rules
   - Time: <1s

9. **wp-config.php Validation**
   - Command: `grep -E "WP_DEBUG|DB_NAME|DB_USER" wp-config.php`
   - Checks: Configuration file integrity
   - Time: <1s

10. **Memory Limit Check**
    - Command: `php -r "echo ini_get('memory_limit');"`
    - Checks: PHP memory limit >= 128MB
    - Time: <1s

11. **HTTP Response Code Check**
    - Method: `fetch()` with HEAD request
    - Checks: Site accessibility (200, 301, 302, etc.)
    - Time: ~2s

12. **SSL Certificate Check**
    - Method: `fetch()` with HTTPS
    - Checks: Valid SSL certificate
    - Time: ~2s

### Implementation Steps

#### Step 1: Update DiagnosisResult Interface
```typescript
interface DiagnosisResult {
  diagnosisType: DiagnosisType;
  confidence: number;
  details: {
    errorType?: string;
    culprit?: string;
    errorMessage?: string;
    logFiles: string[];
    timestamp?: string;
  };
  suggestedAction: string;
  suggestedCommands: string[];
  logsAnalyzed: any[];
  commandOutputs: Array<{
    command: string;
    output: string;
    success: boolean;
    duration: number;
  }>;
}
```

#### Step 2: Add Check Methods to DiagnosisService
Each check method follows this pattern:
```typescript
private async checkXXX(
  serverId: string,
  sitePath: string,
  commandOutputs: any[],
): Promise<{success: boolean, error?: string}> {
  const startTime = Date.now();
  try {
    const command = `...`;
    const output = await this.sshService.executeCommand(serverId, command);
    
    const success = /* validation logic */;
    
    commandOutputs.push({
      command: 'Check Name',
      output: output.substring(0, 500), // Truncate for storage
      success,
      duration: Date.now() - startTime,
    });
    
    return { success, error: success ? undefined : 'Error message' };
  } catch (error) {
    commandOutputs.push({
      command: 'Check Name',
      output: (error as Error).message,
      success: false,
      duration: Date.now() - startTime,
    });
    return { success: false, error: (error as Error).message };
  }
}
```

#### Step 3: Update diagnose() Method
```typescript
async diagnose(serverId: string, sitePath: string, domain: string): Promise<DiagnosisResult> {
  const commandOutputs: Array<{command: string, output: string, success: boolean, duration: number}> = [];
  const startTime = Date.now();

  // Run all checks in parallel
  const [
    logResults,
    maintenanceCheck,
    httpStatus,
    coreIntegrity,
    dbConnection,
    phpErrors,
    apacheErrors,
    diskSpace,
    permissions,
    htaccessCheck,
    wpConfigCheck,
    memoryLimit,
    sslCheck,
  ] = await Promise.all([
    this.logAnalysis.analyzeLogs(serverId, sitePath),
    this.checkMaintenanceMode(serverId, sitePath, commandOutputs),
    this.checkHttpStatus(domain, commandOutputs),
    this.checkCoreIntegrity(serverId, sitePath, commandOutputs),
    this.checkDatabaseConnection(serverId, sitePath, commandOutputs),
    this.checkPHPErrors(serverId, sitePath, commandOutputs),
    this.checkApacheErrors(serverId, commandOutputs),
    this.checkDiskSpace(serverId, sitePath, commandOutputs),
    this.checkPermissions(serverId, sitePath, commandOutputs),
    this.checkHtaccess(serverId, sitePath, commandOutputs),
    this.checkWpConfig(serverId, sitePath, commandOutputs),
    this.checkMemoryLimit(serverId, sitePath, commandOutputs),
    this.checkSSL(domain, commandOutputs),
  ]);

  const totalDuration = Date.now() - startTime;
  this.logger.log(`Extensive diagnosis completed in ${totalDuration}ms`);

  // Priority checks
  if (maintenanceCheck.isStuck) {
    return this.createMaintenanceDiagnosis(maintenanceCheck, logResults, commandOutputs);
  }

  if (!dbConnection.success) {
    return this.createDatabaseDiagnosis({ type: 'DB_CONNECTION', message: dbConnection.error }, logResults, commandOutputs);
  }

  if (!coreIntegrity.success) {
    return this.createCoreIntegrityDiagnosis(coreIntegrity, logResults, commandOutputs);
  }

  // Continue with existing logic...
  return diagnosis;
}
```

#### Step 4: Update All create*Diagnosis Methods
Add `commandOutputs` parameter to all methods:
```typescript
private createPluginFaultDiagnosis(
  error: any,
  logResults: any[],
  commandOutputs: any[],
): DiagnosisResult {
  return {
    // ... existing fields
    commandOutputs, // Add this
  };
}
```

#### Step 5: Update Frontend to Display Command Outputs
Create new component: `DiagnosisCommandOutputs.tsx`
```typescript
interface CommandOutput {
  command: string;
  output: string;
  success: boolean;
  duration: number;
}

export function DiagnosisCommandOutputs({ outputs }: { outputs: CommandOutput[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Diagnostic Command Outputs ({outputs.length})</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Hide Details' : 'View Details'}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          <div className="space-y-4">
            {outputs.map((output, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">{output.command}</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant={output.success ? 'success' : 'destructive'}>
                      {output.success ? 'Success' : 'Failed'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {output.duration}ms
                    </span>
                  </div>
                </div>
                <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto max-h-40">
                  {output.output}
                </pre>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
```

## Part 2: Hierarchical Subdomain Display

### Requirements
- Display subdomains nested under main domain (tree view)
- Parse domain names to identify parent-child relationships
- Use cPanel userdata to distinguish true subdomains vs addon domains
- Each subdomain can be diagnosed independently

### Implementation Steps

#### Step 1: Enhance Site Discovery to Mark Domain Types
Update `SiteDiscoveryService.getAllDomainsWithPaths()`:
```typescript
interface DomainInfo {
  domain: string;
  path: string;
  username: string;
  type: 'MAIN' | 'SUBDOMAIN' | 'ADDON' | 'PARKED';
  parentDomain?: string; // For subdomains
}

private async getAllDomainsWithPaths(serverId: string): Promise<DomainInfo[]> {
  // ... existing code to get domains

  const domainsWithTypes: DomainInfo[] = [];
  
  for (const { domain, path, username } of domains) {
    const type = this.determineDomainType(domain, username, domains);
    const parentDomain = type === 'SUBDOMAIN' ? this.extractParentDomain(domain) : undefined;
    
    domainsWithTypes.push({
      domain,
      path,
      username,
      type,
      parentDomain,
    });
  }
  
  return domainsWithTypes;
}

private determineDomainType(domain: string, username: string, allDomains: any[]): string {
  // Main domain: matches username or is first domain for user
  if (domain === username || domain.startsWith(`${username}.`)) {
    return 'MAIN';
  }
  
  // Check if it's a subdomain of another domain
  const parts = domain.split('.');
  if (parts.length >= 3) {
    const potentialParent = parts.slice(1).join('.');
    if (allDomains.some(d => d.domain === potentialParent && d.username === username)) {
      return 'SUBDOMAIN';
    }
  }
  
  // Otherwise it's an addon domain
  return 'ADDON';
}

private extractParentDomain(subdomain: string): string {
  const parts = subdomain.split('.');
  return parts.slice(1).join('.');
}
```

#### Step 2: Update WpSite Schema
Add fields to track domain hierarchy:
```prisma
model WpSite {
  id              String   @id @default(cuid())
  serverId        String
  domain          String   @unique
  path            String
  cPanelUsername  String?
  
  // NEW FIELDS
  domainType      DomainType @default(MAIN)
  parentDomain    String?
  
  // ... existing fields
}

enum DomainType {
  MAIN
  SUBDOMAIN
  ADDON
  PARKED
}
```

#### Step 3: Update Frontend SiteList Component
Create hierarchical tree view:
```typescript
interface SiteNode {
  site: Site;
  children: SiteNode[];
}

export function SiteList({ sites, onSelectSite }: SiteListProps) {
  // Build tree structure
  const siteTree = useMemo(() => {
    const mainSites = sites.filter(s => s.domainType === 'MAIN' || s.domainType === 'ADDON');
    const subdomains = sites.filter(s => s.domainType === 'SUBDOMAIN');
    
    return mainSites.map(mainSite => ({
      site: mainSite,
      children: subdomains
        .filter(sub => sub.parentDomain === mainSite.domain)
        .map(sub => ({ site: sub, children: [] })),
    }));
  }, [sites]);

  return (
    <div className="space-y-4">
      {siteTree.map(node => (
        <SiteTreeNode
          key={node.site.id}
          node={node}
          onSelectSite={onSelectSite}
        />
      ))}
    </div>
  );
}

function SiteTreeNode({ node, onSelectSite }: { node: SiteNode, onSelectSite: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      {/* Main site card */}
      <div className="flex items-start gap-2">
        {hasChildren && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="mt-2"
          >
            {expanded ? <ChevronDown /> : <ChevronRight />}
          </Button>
        )}
        <SiteCard site={node.site} onDiagnose={onSelectSite} />
      </div>

      {/* Subdomains (indented) */}
      {expanded && hasChildren && (
        <div className="ml-12 mt-2 space-y-2 border-l-2 border-muted pl-4">
          {node.children.map(child => (
            <div key={child.site.id} className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Subdomain</Badge>
              <SiteCard site={child.site} onDiagnose={onSelectSite} compact />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### Step 4: Update SiteCard Component
Add compact mode for subdomains:
```typescript
export function SiteCard({ site, onDiagnose, compact = false }: SiteCardProps) {
  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 border rounded-lg flex-1">
        <div>
          <p className="font-medium">{site.domain}</p>
          <p className="text-sm text-muted-foreground">{site.path}</p>
        </div>
        <Button size="sm" onClick={() => onDiagnose(site.id)}>
          Diagnose
        </Button>
      </div>
    );
  }

  // Full card for main domains
  return (
    <Card>
      {/* ... existing full card implementation */}
    </Card>
  );
}
```

## Testing Plan

### Extensive Diagnosis Testing
1. Test on healthy site - should complete in <10s with all checks passing
2. Test on site with plugin error - should identify plugin and suggest deactivation
3. Test on site with database error - should identify DB issue
4. Test on site with low disk space - should warn about disk space
5. Verify all 12 command outputs are stored and displayable

### Hierarchical Display Testing
1. Discover sites on cPanel server with:
   - Main domain (example.com)
   - Subdomains (blog.example.com, shop.example.com)
   - Addon domains (anotherdomain.com)
2. Verify tree structure displays correctly
3. Verify expand/collapse works
4. Verify each subdomain can be diagnosed independently
5. Verify diagnosis runs in correct directory for each subdomain

## Performance Targets

- **Diagnosis Time:** <10 seconds for all 12 checks (parallel execution)
- **Discovery Time:** <5 seconds for 221 domains (batch for loop)
- **Frontend Render:** <100ms for tree view with 50+ sites

## Files to Modify

### Backend
1. `backend/src/modules/healer/services/diagnosis.service.ts` - Add 12 check methods
2. `backend/src/modules/healer/services/site-discovery.service.ts` - Add domain type detection
3. `backend/prisma/schema.prisma` - Add domainType and parentDomain fields
4. `backend/src/modules/healer/healer.controller.ts` - Return commandOutputs in response

### Frontend
1. `frontend/components/healer/SiteList.tsx` - Add tree view
2. `frontend/components/healer/SiteCard.tsx` - Add compact mode
3. `frontend/components/healer/DiagnosisPanel.tsx` - Add command outputs display
4. `frontend/components/healer/DiagnosisCommandOutputs.tsx` - NEW component
5. `frontend/components/healer/SiteTreeNode.tsx` - NEW component

## Migration Required

```sql
-- Add new fields to WpSite table
ALTER TABLE "WpSite" ADD COLUMN "domainType" TEXT NOT NULL DEFAULT 'MAIN';
ALTER TABLE "WpSite" ADD COLUMN "parentDomain" TEXT;

-- Create enum for domain types
CREATE TYPE "DomainType" AS ENUM ('MAIN', 'SUBDOMAIN', 'ADDON', 'PARKED');
ALTER TABLE "WpSite" ALTER COLUMN "domainType" TYPE "DomainType" USING "domainType"::"DomainType";
```

## Next Steps

1. Implement extensive diagnosis checks (backend)
2. Update database schema and run migration
3. Implement domain type detection in discovery
4. Implement hierarchical tree view (frontend)
5. Test end-to-end with real cPanel server
6. Optimize performance if needed

---

**Status:** PLAN COMPLETE - Ready for Implementation
**Estimated Time:** 8-12 hours
**Priority:** HIGH
