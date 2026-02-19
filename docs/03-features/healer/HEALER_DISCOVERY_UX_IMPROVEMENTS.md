# WP Healer Discovery UX Improvements

## Current Problem

Discovery is slow because:
1. **Sequential SSH calls**: One SSH call per non-main domain to get document root
2. **Blocking operation**: Frontend waits for entire discovery to complete
3. **No progress feedback**: User sees loading spinner with no indication of progress
4. **No caching**: Every discovery re-scans everything

**Example:** 100 domains = 1 + 99 SSH calls = ~30-60 seconds

## Proposed Solutions

### Solution 1: Batch SSH Commands (FASTEST - Recommended)
**Impact:** 100 domains = 2 SSH calls = ~2-3 seconds

Instead of one SSH call per domain, batch all userdata reads into a single command:

```bash
# Single command to get ALL document roots at once
for domain in domain1.com domain2.com domain3.com; do
  username=$(echo "$domain" | cut -d: -f2)
  docroot=$(grep -E "^documentroot:" /var/cpanel/userdata/$username/$domain 2>/dev/null | cut -d: -f2- | xargs)
  echo "$domain|$docroot"
done
```

**Implementation:**
```typescript
private async getAllDocumentRootsBatch(
  serverId: string,
  domains: Array<{domain: string, username: string}>
): Promise<Map<string, string>> {
  // Build single command to get all document roots
  const domainList = domains.map(d => d.domain).join(' ');
  const command = `
    for domain in ${domainList}; do
      username=$(grep "^$domain:" /etc/trueuserdomains | cut -d: -f2 | xargs)
      docroot=$(grep -E "^documentroot:" /var/cpanel/userdata/$username/$domain 2>/dev/null | cut -d: -f2- | xargs)
      echo "$domain|$docroot"
    done
  `;
  
  const result = await this.sshService.executeCommand(serverId, command);
  
  // Parse results
  const map = new Map<string, string>();
  for (const line of result.split('\n')) {
    const [domain, docroot] = line.split('|');
    if (domain && docroot) {
      map.set(domain, docroot);
    }
  }
  
  return map;
}
```

**Pros:**
- 50-100x faster
- Minimal code changes
- Works with existing infrastructure

**Cons:**
- Command might be long for 1000+ domains (can batch in chunks of 100)

---

### Solution 2: Background Job with Progress Updates (BEST UX)
**Impact:** Immediate response + real-time progress

Convert discovery to a background job with SSE (Server-Sent Events) for progress:

**Backend:**
```typescript
@Post('discover')
async discoverSites(@Body() dto: DiscoverSitesDto) {
  // Start background job
  const jobId = await this.healerService.startDiscoveryJob(dto.serverId);
  
  return { 
    jobId,
    message: 'Discovery started',
    statusUrl: `/api/v1/healer/discovery/${jobId}/status`
  };
}

@Get('discovery/:jobId/status')
@Sse()
discoveryProgress(@Param('jobId') jobId: string): Observable<MessageEvent> {
  return this.healerService.getDiscoveryProgress(jobId);
}
```

**Frontend:**
```typescript
// Start discovery
const { jobId } = await startDiscovery(serverId);

// Listen for progress
const eventSource = new EventSource(`/api/v1/healer/discovery/${jobId}/status`);

eventSource.onmessage = (event) => {
  const progress = JSON.parse(event.data);
  // Update UI: "Discovered 45/100 domains..."
  setProgress(progress);
};
```

**Pros:**
- Non-blocking UI
- Real-time progress feedback
- Can cancel long-running discoveries
- Better user experience

**Cons:**
- More complex implementation
- Requires SSE or WebSocket setup

---

### Solution 3: Lazy Discovery (HYBRID APPROACH)
**Impact:** Instant initial response + background enrichment

Discover domains in two phases:

**Phase 1: Fast Discovery (1-2 seconds)**
- Read trueuserdomains
- Use smart path guessing (no userdata lookup)
- Return immediately with "unverified" paths

**Phase 2: Background Enrichment**
- Verify paths in background
- Update database when complete
- Notify user when done

**Implementation:**
```typescript
async discoverSites(serverId: string) {
  // Phase 1: Fast discovery with guessed paths
  const quickDomains = await this.quickDiscovery(serverId);
  
  // Register sites immediately
  await this.registerSites(serverId, quickDomains);
  
  // Phase 2: Background enrichment
  this.enrichDomainsInBackground(serverId, quickDomains);
  
  return {
    domains: quickDomains,
    status: 'enriching',
    message: 'Sites discovered, verifying paths in background'
  };
}

private async quickDiscovery(serverId: string) {
  const domains = await this.getAllDomainsFromTrueuserdomains(serverId);
  
  return domains.map(d => ({
    domain: d.domain,
    username: d.username,
    // Smart path guessing (no SSH calls)
    path: this.guessDocumentRoot(d.domain, d.username),
    verified: false
  }));
}

private guessDocumentRoot(domain: string, username: string): string {
  // Main domain
  if (domain === username || domain.startsWith(`${username}.`)) {
    return `/home/${username}/public_html`;
  }
  
  // Subdomain
  if (domain.includes('.')) {
    return `/home/${username}/public_html/${domain}`;
  }
  
  // Addon domain
  return `/home/${username}/${domain}`;
}
```

**Pros:**
- Fast initial response
- Paths are correct 90% of the time
- Background verification catches edge cases
- Good balance of speed and accuracy

**Cons:**
- Paths might be wrong initially (rare)
- Requires background job infrastructure

---

### Solution 4: Incremental Discovery with Pagination
**Impact:** Show results as they're discovered

Stream results to frontend as they're discovered:

**Backend:**
```typescript
@Get('discover/:serverId/stream')
@Sse()
streamDiscovery(@Param('serverId') serverId: string): Observable<MessageEvent> {
  return new Observable(subscriber => {
    this.discoverSitesIncremental(serverId, (site) => {
      subscriber.next({ data: JSON.stringify(site) });
    }).then(() => {
      subscriber.complete();
    });
  });
}
```

**Frontend:**
```typescript
const eventSource = new EventSource(`/api/v1/healer/discover/${serverId}/stream`);

eventSource.onmessage = (event) => {
  const site = JSON.parse(event.data);
  // Add site to list immediately
  setSites(prev => [...prev, site]);
};
```

**Pros:**
- User sees results immediately
- Feels faster even if total time is same
- Can start working with first sites while others load

**Cons:**
- Requires SSE implementation
- More complex frontend state management

---

### Solution 5: Smart Caching
**Impact:** Instant for repeat discoveries

Cache discovery results with TTL:

```typescript
private discoveryCache = new Map<string, {
  domains: DiscoveredSite[],
  timestamp: Date
}>();

async discoverSites(serverId: string, forceRefresh = false) {
  const cached = this.discoveryCache.get(serverId);
  
  // Return cached if less than 1 hour old
  if (!forceRefresh && cached && 
      Date.now() - cached.timestamp.getTime() < 3600000) {
    return {
      domains: cached.domains,
      cached: true,
      cachedAt: cached.timestamp
    };
  }
  
  // Perform fresh discovery
  const domains = await this.performDiscovery(serverId);
  
  // Cache results
  this.discoveryCache.set(serverId, {
    domains,
    timestamp: new Date()
  });
  
  return { domains, cached: false };
}
```

**Pros:**
- Instant for repeat discoveries
- Reduces server load
- Simple to implement

**Cons:**
- Stale data if domains change
- Requires cache invalidation strategy

---

## Recommended Implementation Strategy

### Phase 1: Quick Win (1-2 hours)
✅ **Implement Solution 1: Batch SSH Commands**
- Reduces discovery time by 50-100x
- Minimal code changes
- Immediate improvement

### Phase 2: Better UX (4-6 hours)
✅ **Implement Solution 3: Lazy Discovery**
- Fast initial response
- Background enrichment
- Good balance of speed and accuracy

### Phase 3: Polish (8-12 hours)
✅ **Add Solution 5: Smart Caching**
- Cache results for 1 hour
- Add "Refresh" button for manual refresh
- Show cache age in UI

### Phase 4: Advanced (Optional)
⚪ **Implement Solution 2: Background Jobs with Progress**
- Best UX for large servers
- Real-time progress updates
- Requires more infrastructure

---

## UI Improvements

### Current UI
```
[Loading spinner]
Discovering sites...
```

### Improved UI - Option A (Simple)
```
[Progress bar: 45/100]
Discovering sites on server.example.com
Found: 45 domains
Estimated time remaining: 15 seconds
```

### Improved UI - Option B (Detailed)
```
[Animated icon]
Discovering WordPress sites...

✓ Read domain list (1/3)
⏳ Checking document roots (2/3)
⏳ Registering sites (3/3)

Found so far: 45 domains
```

### Improved UI - Option C (Incremental)
```
[List grows as sites are discovered]

✓ example.com
✓ blog.example.com
✓ shop.example.com
⏳ Discovering more...

45 sites found, still scanning...
```

---

## Performance Comparison

| Approach | 10 Domains | 100 Domains | 1000 Domains |
|----------|-----------|-------------|--------------|
| Current (Sequential) | 5s | 50s | 500s (8min) |
| Batch Commands | 2s | 3s | 10s |
| Lazy Discovery | 1s | 2s | 5s |
| With Caching | 0.1s | 0.1s | 0.1s |

---

## Implementation Priority

1. **HIGH**: Batch SSH Commands (Solution 1)
2. **HIGH**: Smart Caching (Solution 5)
3. **MEDIUM**: Lazy Discovery (Solution 3)
4. **MEDIUM**: Progress UI improvements
5. **LOW**: Background Jobs with SSE (Solution 2)
6. **LOW**: Incremental Discovery (Solution 4)

---

## Code Changes Required

### Solution 1: Batch Commands (Recommended First Step)

**File:** `backend/src/modules/healer/services/site-discovery.service.ts`

**Changes:**
1. Replace `getDomainDocumentRoot()` loop with batch command
2. Parse batch results
3. Fallback to smart guessing if batch fails

**Estimated Time:** 1-2 hours
**Risk:** Low
**Impact:** High (50-100x faster)

---

## Testing Checklist

- [ ] Discovery completes in <5 seconds for 100 domains
- [ ] All domain types discovered correctly
- [ ] Document roots are accurate
- [ ] Cache works correctly
- [ ] Cache invalidation works
- [ ] Progress updates in real-time (if implemented)
- [ ] Error handling for failed discoveries
- [ ] UI shows meaningful progress

---

## Future Enhancements

1. **Differential Discovery**: Only check for new/changed domains
2. **Scheduled Discovery**: Auto-discover nightly
3. **Domain Change Detection**: Alert when domains are added/removed
4. **Bulk Import**: Import domain list from CSV
5. **Manual Add**: Add single domain without full discovery
