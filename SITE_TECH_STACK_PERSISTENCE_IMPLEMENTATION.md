# Site Tech Stack Persistence Implementation

## Overview
Implemented persistent storage for tech stack and domain addon information discovered by Universal Healer's diagnosis system. This ensures that tech stack data, SSL information, DNS records, email accounts, and domain types are saved to the database when discovered via "View Details" or BullMQ queues.

## Database Schema Changes

### New Table: `site_tech_stack`
Created a new table with one-to-one relationship to `applications` table:

```prisma
model site_tech_stack {
  id                    String          @id @default(uuid())
  applicationId         String          @unique @map("application_id")
  
  // Tech Stack Information (persisted from detection)
  techStack             TechStack       @map("tech_stack")
  techStackVersion      String?         @map("tech_stack_version")
  detectionMethod       DetectionMethod @map("detection_method")
  detectionConfidence   Float           @map("detection_confidence")
  detectedAt            DateTime        @default(now()) @map("detected_at")
  
  // Domain Addon Information
  sslEnabled            Boolean?        @map("ssl_enabled")
  sslIssuer             String?         @map("ssl_issuer")
  sslExpiryDate         DateTime?       @map("ssl_expiry_date")
  dnsRecords            Json?           @map("dns_records")
  emailAccountsCount    Int?            @map("email_accounts_count")
  emailQuotaUsedMB      Float?          @map("email_quota_used_mb")
  emailQuotaTotalMB     Float?          @map("email_quota_total_mb")
  
  // Domain Type
  isMainDomain          Boolean         @default(true) @map("is_main_domain")
  isSubdomain           Boolean         @default(false) @map("is_subdomain")
  isParkedDomain        Boolean         @default(false) @map("is_parked_domain")
  isAddonDomain         Boolean         @default(false) @map("is_addon_domain")
  
  // Additional Metadata
  metadata              Json            @default("{}")
  
  // Timestamps
  createdAt             DateTime        @default(now()) @map("created_at")
  updatedAt             DateTime        @updatedAt @map("updated_at")
  
  // Relations
  applications          applications    @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  
  @@index([applicationId])
  @@index([techStack])
  @@index([detectedAt])
  @@map("site_tech_stack")
}
```

### Migration
- Created migration: `20260306095911_add_site_tech_stack_table`
- Applied successfully to database

## Backend Implementation

### 1. Service Layer

#### `SiteTechStackService`
Location: `backend/src/modules/healer/services/site-tech-stack.service.ts`

**Methods:**
- `saveTechStack(applicationId, data)` - Save or update tech stack information (upsert)
- `getTechStack(applicationId)` - Get tech stack information for an application
- `updateDomainAddons(applicationId, addons)` - Update SSL, DNS, email information
- `updateDomainType(applicationId, domainType)` - Update domain type flags
- `deleteTechStack(applicationId)` - Delete tech stack information
- `findAll(filters)` - Get all tech stacks with optional filters

### 2. Processor Integration

#### `TechStackDetectionProcessor`
Location: `backend/src/modules/healer/processors/techstack-detection.processor.ts`

**Changes:**
- Injected `SiteTechStackService`
- Added automatic persistence after successful tech stack detection
- Saves tech stack data to `site_tech_stack` table when tech stack is not UNKNOWN
- Handles errors gracefully without breaking the detection flow

**Flow:**
1. Tech stack detected via queue or manual "View Details"
2. If tech stack !== 'UNKNOWN', save to `site_tech_stack` table
3. Continue with normal detection flow (update `applications` table)
4. Log success or error

### 3. API Endpoints

#### `ApplicationController`
Location: `backend/src/modules/healer/controllers/application.controller.ts`

**New Endpoints:**

1. **GET** `/healer/applications/:id/tech-stack`
   - Get persistent tech stack information
   - Permissions: `healer:read`

2. **PUT** `/healer/applications/:id/tech-stack/addons`
   - Update domain addon information (SSL, DNS, email)
   - Permissions: `healer:update`
   - Body: `UpdateDomainAddonsDto`

3. **PUT** `/healer/applications/:id/tech-stack/domain-type`
   - Update domain type information
   - Permissions: `healer:update`
   - Body: `UpdateDomainTypeDto`

4. **GET** `/healer/applications/tech-stacks/all`
   - Get all tech stacks with filters
   - Permissions: `healer:read`
   - Query params: `techStack`, `isMainDomain`, `isSubdomain`, `isParkedDomain`, `isAddonDomain`

### 4. DTOs

#### `site-tech-stack.dto.ts`
Location: `backend/src/modules/healer/dto/site-tech-stack.dto.ts`

**Classes:**
- `UpdateDomainAddonsDto` - For updating SSL, DNS, email information
- `UpdateDomainTypeDto` - For updating domain type flags
- `SiteTechStackResponseDto` - Response format for tech stack data

### 5. Module Registration

#### `HealerModule`
Location: `backend/src/modules/healer/healer.module.ts`

**Changes:**
- Added `SiteTechStackService` to imports
- Added `SiteTechStackService` to providers
- Service is now available throughout the healer module

## Frontend Implementation

### 1. API Client

#### `site-tech-stack.ts`
Location: `frontend/lib/api/site-tech-stack.ts`

**Interface:**
```typescript
export interface SiteTechStack {
  id: string;
  applicationId: string;
  techStack: string;
  techStackVersion?: string;
  detectionMethod: string;
  detectionConfidence: number;
  detectedAt: string;
  sslEnabled?: boolean;
  sslIssuer?: string;
  sslExpiryDate?: string;
  dnsRecords?: any;
  emailAccountsCount?: number;
  emailQuotaUsedMB?: number;
  emailQuotaTotalMB?: number;
  isMainDomain: boolean;
  isSubdomain: boolean;
  isParkedDomain: boolean;
  isAddonDomain: boolean;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}
```

**API Methods:**
- `getTechStack(applicationId)` - Fetch tech stack information
- `updateDomainAddons(applicationId, addons)` - Update domain addons
- `updateDomainType(applicationId, domainType)` - Update domain type
- `getAllTechStacks(filters)` - Fetch all tech stacks with filters

### 2. React Hooks

#### `use-site-tech-stack.ts`
Location: `frontend/hooks/use-site-tech-stack.ts`

**Hooks:**
- `useSiteTechStack(applicationId)` - Query hook for fetching tech stack
- `useUpdateDomainAddons()` - Mutation hook for updating domain addons
- `useUpdateDomainType()` - Mutation hook for updating domain type
- `useAllSiteTechStacks(filters)` - Query hook for fetching all tech stacks

**Features:**
- Automatic cache invalidation on mutations
- 5-minute stale time for queries
- Retry logic for failed requests
- TypeScript type safety

## Data Flow

### Tech Stack Detection Flow

1. **Trigger:**
   - User clicks "View Details" on an application
   - BullMQ queue processes discovery job

2. **Detection:**
   - `TechStackDetectionProcessor` processes the job
   - `ApplicationService.detectTechStack()` runs detection
   - Tech stack detected and saved to `applications` table

3. **Persistence:**
   - If tech stack !== 'UNKNOWN':
     - `SiteTechStackService.saveTechStack()` called
     - Data upserted to `site_tech_stack` table
     - Includes: tech stack, version, confidence, detection method
     - Domain type flags set (isMainDomain, isSubdomain, etc.)

4. **Frontend Display:**
   - `useSiteTechStack(applicationId)` hook fetches data
   - Component displays tech stack information
   - Shows SSL status, email accounts, domain type, etc.

### Domain Addon Update Flow

1. **User Action:**
   - User updates SSL, DNS, or email information in UI

2. **API Call:**
   - `useUpdateDomainAddons()` mutation triggered
   - PUT request to `/healer/applications/:id/tech-stack/addons`

3. **Backend Processing:**
   - `SiteTechStackService.updateDomainAddons()` updates database
   - Only updates provided fields (partial update)

4. **Cache Invalidation:**
   - React Query invalidates `siteTechStack` and `application` queries
   - UI automatically refetches and updates

## Key Features

### 1. Automatic Persistence
- Tech stack data automatically saved when detected
- No manual intervention required
- Works with both queue-based and manual detection

### 2. Immutable Detection Data
- Tech stack and version saved on first detection
- Subsequent detections update the data (diagnosis updates values)
- Detection timestamp preserved

### 3. Flexible Domain Addons
- SSL information (enabled, issuer, expiry date)
- DNS records (stored as JSON)
- Email account information (count, quota used/total)
- Domain type flags (main, subdomain, parked, addon)

### 4. Query Optimization
- Indexed on `applicationId`, `techStack`, `detectedAt`
- Efficient filtering by tech stack and domain type
- One-to-one relationship prevents duplicates

### 5. Type Safety
- Full TypeScript support on frontend and backend
- Prisma-generated types for database operations
- Validated DTOs for API requests

## Usage Examples

### Backend

```typescript
// Save tech stack after detection
await siteTechStackService.saveTechStack(applicationId, {
  techStack: 'WORDPRESS',
  techStackVersion: '6.4.2',
  detectionMethod: 'AUTO',
  detectionConfidence: 0.95,
  isMainDomain: true,
  isSubdomain: false,
  isParkedDomain: false,
  isAddonDomain: false,
});

// Update domain addons
await siteTechStackService.updateDomainAddons(applicationId, {
  sslEnabled: true,
  sslIssuer: 'Let\'s Encrypt',
  sslExpiryDate: new Date('2025-06-01'),
  emailAccountsCount: 5,
  emailQuotaUsedMB: 250.5,
  emailQuotaTotalMB: 1000,
});

// Get tech stack information
const techStack = await siteTechStackService.getTechStack(applicationId);
```

### Frontend

```typescript
// Fetch tech stack information
const { data: techStack, isLoading } = useSiteTechStack(applicationId);

// Update domain addons
const updateAddons = useUpdateDomainAddons();
await updateAddons.mutateAsync({
  applicationId,
  addons: {
    sslEnabled: true,
    sslIssuer: 'Let\'s Encrypt',
    emailAccountsCount: 5,
  },
});

// Display tech stack information
{techStack && (
  <div>
    <p>Tech Stack: {techStack.techStack}</p>
    <p>Version: {techStack.techStackVersion}</p>
    <p>SSL: {techStack.sslEnabled ? 'Enabled' : 'Disabled'}</p>
    <p>Email Accounts: {techStack.emailAccountsCount}</p>
  </div>
)}
```

## Testing

### Manual Testing Steps

1. **Test Tech Stack Detection:**
   ```bash
   # Trigger discovery for a server
   POST /healer/applications/discover-queued
   {
     "serverId": "server-id",
     "forceRediscover": false
   }
   
   # Check if tech stack was saved
   GET /healer/applications/:id/tech-stack
   ```

2. **Test Domain Addon Updates:**
   ```bash
   # Update SSL information
   PUT /healer/applications/:id/tech-stack/addons
   {
     "sslEnabled": true,
     "sslIssuer": "Let's Encrypt",
     "sslExpiryDate": "2025-06-01T00:00:00Z"
   }
   
   # Verify update
   GET /healer/applications/:id/tech-stack
   ```

3. **Test Domain Type Updates:**
   ```bash
   # Update domain type
   PUT /healer/applications/:id/tech-stack/domain-type
   {
     "isMainDomain": false,
     "isSubdomain": true
   }
   
   # Verify update
   GET /healer/applications/:id/tech-stack
   ```

4. **Test Filtering:**
   ```bash
   # Get all WordPress sites
   GET /healer/applications/tech-stacks/all?techStack=WORDPRESS
   
   # Get all main domains
   GET /healer/applications/tech-stacks/all?isMainDomain=true
   ```

## Benefits

1. **Data Persistence:** Tech stack information is never lost, even if application is re-discovered
2. **Historical Tracking:** Detection timestamp allows tracking when tech stack was first identified
3. **Domain Management:** Comprehensive domain addon information in one place
4. **Performance:** Indexed queries for fast filtering and retrieval
5. **Flexibility:** JSON fields for DNS records and metadata allow storing complex data
6. **Type Safety:** Full TypeScript support prevents runtime errors
7. **Automatic Updates:** Diagnosis updates values automatically without manual intervention

## Future Enhancements

1. **SSL Monitoring:** Automatic alerts when SSL certificates are about to expire
2. **Email Quota Alerts:** Notify when email quota reaches threshold
3. **DNS Change Detection:** Track DNS record changes over time
4. **Tech Stack Version Tracking:** Historical log of version upgrades
5. **Subdomain Tech Stack:** Extend to support subdomain-specific tech stack persistence
6. **Bulk Operations:** Batch update domain addons for multiple applications
7. **Export/Import:** Export tech stack data for reporting or migration

## Files Changed

### Backend
- `backend/prisma/schema.prisma` - Added `site_tech_stack` model
- `backend/src/modules/healer/services/site-tech-stack.service.ts` - New service
- `backend/src/modules/healer/dto/site-tech-stack.dto.ts` - New DTOs
- `backend/src/modules/healer/controllers/application.controller.ts` - New endpoints
- `backend/src/modules/healer/processors/techstack-detection.processor.ts` - Auto-save logic
- `backend/src/modules/healer/healer.module.ts` - Service registration

### Frontend
- `frontend/lib/api/site-tech-stack.ts` - API client
- `frontend/hooks/use-site-tech-stack.ts` - React hooks

### Database
- Migration: `backend/prisma/migrations/20260306095911_add_site_tech_stack_table/migration.sql`

## Conclusion

Successfully implemented persistent storage for tech stack and domain addon information. The system now automatically saves tech stack data when discovered via "View Details" or BullMQ queues, and provides comprehensive API endpoints for managing domain addon information. The implementation follows OpsManager's architecture patterns and maintains type safety throughout the stack.
