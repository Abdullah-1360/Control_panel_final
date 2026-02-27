# Universal Healer Discovery Optimization Strategy

**Date:** February 26, 2026  
**Status:** DESIGN DOCUMENT

## Problem Analysis

### Current Issues

#### 1. Universal Application Discovery is Inefficient
**File:** `backend/src/modules/healer/services/application.service.ts`

**Problems:**
- Scans only 2 hardcoded paths: `/var/www` and `/home`
- Checks each path individually with SSH calls
- Detects tech stack for EVERY path (expensive)
- No batching or optimization
- No progress tracking
- Can timeout on large servers

**Current Flow:**
```typescript
for (const basePath of ['/var/www', '/home']) {
  // SSH call 1: Detect tech stack
  const detection = await this.techStackDetector.detectTechStack(server, basePath);
  
  // SSH call 2: Check if exists in DB
  const existing = await this.prisma.applications.findFirst(...);
  
  // SSH call 3: Create application
  await this.prisma.applications.create(...);
}
```

**Result:** 3+ SSH calls per path, sequential execution, no real discovery

#### 2. Tech Stack Detector is Too Granular
**File:** `backend/src/modules/healer/services/tech-stack-detector.service.ts`

**Problems:**
- Checks files one by one: `[ -e "/path/file1" ] && [ -e "/path/file2" ]`
- Reads package.json/composer.json for every path
- No caching or batch detection
- Runs version commands for every detection

#### 3. WordPress Discovery is Optimized (Good Example)
**File:** `backend/src/modules/healer/services/site-discovery.service.ts`

**Strengths:**
- Uses `find` command to locate all wp-config.php files at once
- Batch command to get all document roots in 2 SSH calls
- Smart path guessing as fallback
- Registers sites first, collects metadata on-demand
- Handles 100+ sites efficiently

**Key Optimization:**
```typescript
// Single SSH call to find ALL WordPress installations
const command = `find ${searchPath} -maxdepth 3 -name "wp-config.php" 2>/dev/null || true`;

// Batch command to get ALL document roots at once
const command = `for item in ${domainList}; do ...; done`;
```

### Server Flooding Risk

**Scenario:** User clicks "Discover Applications" with "Auto-detect all tech stacks"

**What Happens:**
1. System tries to detect 5 tech stacks (NodeJS, Laravel, PHP, Express, NextJS)
2. Each tech stack check requires 3-5 SSH commands
3. For 10 paths × 5 tech stacks = 50 paths to check
4. 50 paths × 5 SSH calls = **250 SSH commands**
5. At 1 second per SSH call = **4+ minutes**
6. Server CPU/IO spikes from file checks
7. SSH connection limits may be hit
8. User sees "Discovering..." with no progress

**Worse Case:** Multiple users discovering simultaneously = server overload

---

## Solution Design

### Strategy 1: Batch Discovery with Single Find Command

**Concept:** Use a single `find` command to locate ALL application indicators at once

**Implementation:**

```typescript
async discoverAllApplications(serverId: string, techStacks?: TechStack[]): Promise<DiscoveredApp[]> {
  const server = await this.getServer(serverId);
  
  // Step 1: Single SSH command to find ALL application indicators
  const indicators = this.buildIndicatorsList(techStacks);
  const findCommand = this.buildBatchFindCommand(indicators);
  
  // Example: find /var/www /home -maxdepth 4 \( -name "wp-config.php" -o -name "package.json" -o -name "artisan" -o -name "composer.json" \) 2>/dev/null
  
  const result = await this.sshExecutor.executeCommand(serverId, findCommand);
  
  // Step 2: Parse results and group by directory
  const foundPaths = this.parseFoundPaths(result);
  
  // Step 3: Classify tech stacks based on file combinations
  const applications = this.classifyApplications(foundPaths);
  
  // Step 4: Batch insert into database
  return await this.batchRegisterApplications(serverId, applications);
}

private buildBatchFindCommand(indicators: string[]): string {
  // Build a single find command that searches for all indicators
  const nameConditions = indicators.map(ind => `-name "${ind}"`).join(' -o ');
  
  return `find /var/www /home /srv /opt -maxdepth 4 \\( ${nameConditions} \\) -type f 2>/dev/null | head -1000`;
}

private classifyApplications(foundPaths: Map<string, string[]>): DiscoveredApp[] {
  const apps: DiscoveredApp[] = [];
  
  for (const [path, files] of foundPaths.entries()) {
    const techStack = this.determineTechStack(files);
    
    if (techStack !== 'UNKNOWN') {
      apps.push({
        path,
        techStack,
        confidence: this.calculateConfidence(files, techStack),
        files, // Store for later metadata collection
      });
    }
  }
  
  return apps;
}

private determineTechStack(files: string[]): TechStack {
  // Priority-based classification
  if (files.includes('wp-config.php') && files.includes('wp-content')) {
    return 'WORDPRESS';
  }
  
  if (files.includes('artisan') && files.includes('composer.json')) {
    return 'LARAVEL';
  }
  
  if (files.includes('next.config.js') && files.includes('package.json')) {
    return 'NEXTJS';
  }
  
  if (files.includes('package.json')) {
    // Need to read package.json to distinguish Node/Express
    return 'NODEJS'; // Will refine later
  }
  
  if (files.includes('composer.json') || files.includes('index.php')) {
    return 'PHP_GENERIC';
  }
  
  return 'UNKNOWN';
}
```

**Benefits:**
- **1 SSH call** instead of 250+
- Finds all applications in ~2-5 seconds
- No server flooding
- Scales to 1000+ applications

---

### Strategy 2: Queue-Based Discovery with Progress Tracking

**Concept:** Use BullMQ to queue discovery jobs and provide real-time progress

**Implementation:**

```typescript
// Controller
@Post('discover')
async discover(@Body() dto: DiscoverApplicationsDto) {
  // Add job to queue
  const job = await this.discoveryQueue.add('discover-applications', {
    serverId: dto.serverId,
    techStacks: dto.techStacks,
    paths: dto.paths,
  });
  
  return {
    jobId: job.id,
    status: 'queued',
    message: 'Discovery started. Check progress at /healer/applications/discover/:jobId',
  };
}

@Get('discover/:jobId')
async getDiscoveryProgress(@Param('jobId') jobId: string) {
  const job = await this.discoveryQueue.getJob(jobId);
  
  if (!job) {
    throw new NotFoundException('Job not found');
  }
  
  return {
    jobId: job.id,
    status: await job.getState(),
    progress: job.progress,
    result: await job.returnvalue,
  };
}

// Worker
@Processor('discovery')
export class DiscoveryProcessor {
  @Process('discover-applications')
  async handleDiscovery(job: Job) {
    const { serverId, techStacks, paths } = job.data;
    
    // Update progress: 0% - Starting
    await job.updateProgress(0);
    
    // Step 1: Find all application indicators (20%)
    await job.updateProgress(20);
    const indicators = await this.findAllIndicators(serverId, paths);
    
    // Step 2: Classify applications (40%)
    await job.updateProgress(40);
    const applications = await this.classifyApplications(indicators);
    
    // Step 3: Register in database (60%)
    await job.updateProgress(60);
    const registered = await this.registerApplications(serverId, applications);
    
    // Step 4: Collect basic metadata (80%)
    await job.updateProgress(80);
    await this.collectBasicMetadata(registered);
    
    // Complete (100%)
    await job.updateProgress(100);
    
    return {
      discovered: registered.length,
      applications: registered,
    };
  }
}
```

**Benefits:**
- Non-blocking discovery
- Real-time progress updates
- Can handle long-running discoveries
- Prevents timeout issues
- User sees progress bar

---

### Strategy 3: Two-Phase Discovery (Fast + Detailed)

**Concept:** Quick discovery first, detailed metadata collection on-demand

**Phase 1: Fast Discovery (2-5 seconds)**
```typescript
async quickDiscover(serverId: string): Promise<Application[]> {
  // Find all application indicators in one command
  const foundPaths = await this.batchFindApplications(serverId);
  
  // Register applications with minimal data
  const apps = await Promise.all(
    foundPaths.map(async (app) => {
      return this.prisma.applications.create({
        data: {
          serverId,
          domain: this.extractDomain(app.path),
          path: app.path,
          techStack: app.techStack,
          detectionMethod: 'AUTO',
          detectionConfidence: app.confidence,
          
          // Minimal metadata - no version, no detailed checks
          metadata: { files: app.files },
          
          isHealerEnabled: false,
          healingMode: 'MANUAL',
          healthStatus: 'UNKNOWN',
          healthScore: 0,
        },
      });
    })
  );
  
  return apps;
}
```

**Phase 2: Detailed Metadata (On-Demand)**
```typescript
async collectDetailedMetadata(applicationId: string): Promise<void> {
  const app = await this.prisma.applications.findUnique({
    where: { id: applicationId },
  });
  
  // Collect version, dependencies, configuration
  const metadata = await this.techStackDetector.getDetailedMetadata(
    app.serverId,
    app.path,
    app.techStack,
  );
  
  await this.prisma.applications.update({
    where: { id: applicationId },
    data: {
      techStackVersion: metadata.version,
      metadata: metadata.details,
      updatedAt: new Date(),
    },
  });
}
```

**When to Collect Detailed Metadata:**
- User clicks on application card
- User runs diagnostics
- Scheduled background job (low priority)

**Benefits:**
- Discovery completes in seconds
- No server flooding
- Metadata collected only when needed
- Better user experience

---

### Strategy 4: Rate Limiting and Throttling

**Concept:** Limit concurrent SSH connections and add delays

**Implementation:**

```typescript
@Injectable()
export class SSHExecutorService {
  private readonly MAX_CONCURRENT = 5; // Max 5 concurrent SSH connections
  private readonly DELAY_BETWEEN_COMMANDS = 100; // 100ms delay
  
  private semaphore = new Semaphore(this.MAX_CONCURRENT);
  
  async executeCommand(serverId: string, command: string): Promise<string> {
    // Acquire semaphore (wait if 5 connections active)
    await this.semaphore.acquire();
    
    try {
      // Add small delay to prevent flooding
      await this.delay(this.DELAY_BETWEEN_COMMANDS);
      
      // Execute command
      return await this.executeSSHCommand(serverId, command);
    } finally {
      // Release semaphore
      this.semaphore.release();
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class Semaphore {
  private queue: Array<() => void> = [];
  private current = 0;
  
  constructor(private max: number) {}
  
  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    
    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }
  
  release(): void {
    this.current--;
    const next = this.queue.shift();
    if (next) {
      this.current++;
      next();
    }
  }
}
```

**Benefits:**
- Prevents SSH connection exhaustion
- Reduces server load
- Prevents "Too many connections" errors
- Smooth operation under load

---

## Recommended Implementation Plan

### Phase 1: Immediate Fixes (1-2 hours)

1. **Fix Universal Discovery to Use Batch Find**
   - Replace loop-based discovery with single `find` command
   - Implement file-based tech stack classification
   - Test with real server

2. **Add Rate Limiting to SSH Executor**
   - Implement semaphore for max 5 concurrent connections
   - Add 100ms delay between commands
   - Test under load

### Phase 2: Queue-Based Discovery (2-3 hours)

1. **Create Discovery Queue**
   - Setup BullMQ queue for discovery jobs
   - Create discovery processor
   - Add progress tracking

2. **Update API Endpoints**
   - POST /discover returns jobId
   - GET /discover/:jobId returns progress
   - Frontend polls for progress

3. **Frontend Progress UI**
   - Show progress bar during discovery
   - Display "Discovering... 45%" message
   - Auto-refresh when complete

### Phase 3: Two-Phase Metadata Collection (1-2 hours)

1. **Separate Quick Discovery from Metadata**
   - Quick discovery registers apps with minimal data
   - Metadata collection happens on-demand
   - Background job for bulk metadata collection

2. **Update Diagnostics to Trigger Metadata**
   - When user runs diagnostics, collect metadata first
   - Cache metadata for 1 hour
   - Show loading state in UI

---

## Performance Comparison

### Current Implementation
```
Discovery Time: 4-5 minutes (250+ SSH calls)
Server Load: HIGH (sequential file checks)
User Experience: Poor (long wait, no progress)
Scalability: BAD (doesn't scale beyond 50 apps)
```

### Optimized Implementation
```
Discovery Time: 2-5 seconds (1-2 SSH calls)
Server Load: LOW (single find command)
User Experience: EXCELLENT (fast, progress bar)
Scalability: EXCELLENT (handles 1000+ apps)
```

### WordPress Discovery (Current - Already Optimized)
```
Discovery Time: 5-10 seconds (2-3 SSH calls)
Server Load: LOW (batch commands)
User Experience: GOOD (fast discovery)
Scalability: EXCELLENT (handles 100+ sites)
```

---

## Code Changes Required

### 1. Update Application Service

**File:** `backend/src/modules/healer/services/application.service.ts`

```typescript
async discover(params: {
  serverId: string;
  paths?: string[];
  techStacks?: TechStack[];
}) {
  this.logger.log(`Discovering applications on server ${params.serverId}`);

  const server = await this.prisma.servers.findUnique({
    where: { id: params.serverId },
  });

  if (!server) {
    throw new NotFoundException(`Server ${params.serverId} not found`);
  }

  // Use batch discovery instead of loop
  const discoveredApps = await this.batchDiscoverApplications(
    server,
    params.paths || ['/var/www', '/home', '/srv', '/opt'],
    params.techStacks,
  );

  this.logger.log(`Discovered ${discoveredApps.length} new applications`);

  return {
    discovered: discoveredApps.length,
    applications: discoveredApps,
  };
}

private async batchDiscoverApplications(
  server: any,
  searchPaths: string[],
  techStacks?: TechStack[],
): Promise<any[]> {
  // Build indicator list based on requested tech stacks
  const indicators = this.buildIndicatorsList(techStacks);
  
  // Single find command to locate all indicators
  const nameConditions = indicators.map(ind => `-name "${ind}"`).join(' -o ');
  const pathList = searchPaths.join(' ');
  const findCommand = `find ${pathList} -maxdepth 4 \\( ${nameConditions} \\) -type f 2>/dev/null | head -1000`;
  
  const result = await this.sshExecutor.executeCommand(server.id, findCommand);
  
  if (!result || !result.trim()) {
    return [];
  }
  
  // Parse and group by directory
  const foundFiles = result.trim().split('\n');
  const pathMap = new Map<string, string[]>();
  
  for (const filePath of foundFiles) {
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
    
    if (!pathMap.has(dir)) {
      pathMap.set(dir, []);
    }
    pathMap.get(dir)!.push(fileName);
  }
  
  // Classify and register applications
  const apps: any[] = [];
  
  for (const [path, files] of pathMap.entries()) {
    const techStack = this.determineTechStack(files);
    
    if (techStack === 'UNKNOWN') continue;
    
    // Check if already exists
    const existing = await this.prisma.applications.findFirst({
      where: {
        serverId: server.id,
        path,
      },
    });
    
    if (existing) continue;
    
    // Extract domain
    const domain = await this.extractDomain(server.id, path);
    
    // Create application
    const app = await this.prisma.applications.create({
      data: {
        serverId: server.id,
        domain: domain || path.split('/').pop() || server.host,
        path,
        techStack: techStack as TechStack,
        detectionMethod: DetectionMethod.AUTO,
        detectionConfidence: this.calculateConfidence(files, techStack),
        metadata: { detectedFiles: files },
        isHealerEnabled: false,
        healingMode: HealingMode.MANUAL,
        healthStatus: HealthStatus.UNKNOWN,
        healthScore: 0,
      },
    });
    
    apps.push(app);
  }
  
  return apps;
}

private buildIndicatorsList(techStacks?: TechStack[]): string[] {
  const allIndicators = {
    WORDPRESS: ['wp-config.php', 'wp-content'],
    NODEJS: ['package.json'],
    LARAVEL: ['artisan', 'composer.json'],
    NEXTJS: ['next.config.js', 'next.config.ts'],
    EXPRESS: ['package.json'],
    PHP_GENERIC: ['index.php', 'composer.json'],
  };
  
  if (!techStacks || techStacks.length === 0) {
    // Return all indicators
    return [...new Set(Object.values(allIndicators).flat())];
  }
  
  // Return only requested tech stack indicators
  const indicators: string[] = [];
  for (const stack of techStacks) {
    if (allIndicators[stack]) {
      indicators.push(...allIndicators[stack]);
    }
  }
  
  return [...new Set(indicators)];
}

private determineTechStack(files: string[]): string {
  // Priority-based classification
  if (files.includes('wp-config.php')) {
    return 'WORDPRESS';
  }
  
  if (files.includes('artisan') && files.includes('composer.json')) {
    return 'LARAVEL';
  }
  
  if (files.includes('next.config.js') || files.includes('next.config.ts')) {
    return 'NEXTJS';
  }
  
  if (files.includes('package.json')) {
    // Will need to read package.json to distinguish Node/Express
    // For now, classify as NODEJS
    return 'NODEJS';
  }
  
  if (files.includes('composer.json') || files.includes('index.php')) {
    return 'PHP_GENERIC';
  }
  
  return 'UNKNOWN';
}

private calculateConfidence(files: string[], techStack: string): number {
  const requiredFiles = {
    WORDPRESS: ['wp-config.php'],
    LARAVEL: ['artisan', 'composer.json'],
    NEXTJS: ['next.config.js', 'package.json'],
    NODEJS: ['package.json'],
    EXPRESS: ['package.json'],
    PHP_GENERIC: ['index.php'],
  };
  
  const required = requiredFiles[techStack] || [];
  const found = required.filter(f => files.includes(f)).length;
  
  return found / required.length;
}

private async extractDomain(serverId: string, path: string): Promise<string | null> {
  try {
    // Try nginx config
    const nginxCmd = `grep -r "root ${path}" /etc/nginx/sites-enabled/ 2>/dev/null | grep server_name | head -n 1 | sed 's/.*server_name //;s/;.*//' || true`;
    const nginxResult = await this.sshExecutor.executeCommand(serverId, nginxCmd);
    
    if (nginxResult && nginxResult.trim()) {
      return nginxResult.trim().split(' ')[0];
    }
    
    // Try Apache config
    const apacheCmd = `grep -r "DocumentRoot ${path}" /etc/apache2/sites-enabled/ /etc/httpd/conf.d/ 2>/dev/null | grep ServerName | head -n 1 | awk '{print $2}' || true`;
    const apacheResult = await this.sshExecutor.executeCommand(serverId, apacheCmd);
    
    if (apacheResult && apacheResult.trim()) {
      return apacheResult.trim();
    }
    
    return null;
  } catch {
    return null;
  }
}
```

### 2. Add Rate Limiting to SSH Executor

**File:** `backend/src/modules/healer/services/ssh-executor.service.ts`

Add semaphore implementation at the top of the class.

---

## Testing Plan

### 1. Unit Tests
- Test batch find command generation
- Test tech stack classification logic
- Test confidence calculation
- Test semaphore rate limiting

### 2. Integration Tests
- Test discovery on server with 100+ applications
- Test discovery with specific tech stacks
- Test discovery with no applications found
- Test concurrent discoveries

### 3. Load Tests
- 10 concurrent discovery requests
- Discovery on server with 1000+ directories
- SSH connection limit testing

---

## Monitoring and Metrics

### Metrics to Track
- Discovery time (seconds)
- Number of SSH calls per discovery
- Applications discovered per server
- False positive rate (wrong tech stack)
- Server CPU/memory during discovery

### Alerts
- Discovery taking >30 seconds
- SSH connection failures
- High false positive rate (>10%)

---

## Conclusion

The current universal discovery is inefficient and can flood servers. By implementing:

1. **Batch find commands** (1 SSH call instead of 250+)
2. **Rate limiting** (max 5 concurrent connections)
3. **Two-phase discovery** (fast discovery + on-demand metadata)
4. **Queue-based processing** (progress tracking)

We can achieve:
- **50x faster discovery** (5 seconds vs 4 minutes)
- **No server flooding** (controlled SSH connections)
- **Better UX** (progress bars, fast results)
- **Scalability** (handles 1000+ applications)

The WordPress discovery already follows these patterns and should serve as the reference implementation for universal discovery.
