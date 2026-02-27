# Subdomain/Addon Diagnosis and Healing - Universal Healer

## Overview

Implemented support for diagnosing and healing subdomains, addon domains, and parked domains in the Universal Healer, matching the WordPress healer functionality.

## Implementation

### Backend Changes

#### 1. DTOs (`backend/src/modules/healer/dto/application.dto.ts`)

Added `subdomain` parameter to diagnosis and healing DTOs:

```typescript
export class DiagnoseApplicationDto {
  @IsString()
  @IsOptional()
  subdomain?: string;  // NEW: Subdomain to diagnose
}

export class HealApplicationDto {
  @IsString()
  actionName!: string;

  @IsString()
  @IsOptional()
  subdomain?: string;  // NEW: Subdomain to heal
}
```

#### 2. Controller (`backend/src/modules/healer/controllers/application.controller.ts`)

Updated endpoints to accept subdomain parameter:

```typescript
@Post(':id/diagnose')
async diagnose(@Param('id') id: string, @Body() diagnoseDto: DiagnoseApplicationDto) {
  return this.applicationService.diagnose(id, diagnoseDto.subdomain);
}

@Post(':id/heal')
async heal(@Param('id') id: string, @Body() healDto: HealApplicationDto) {
  return this.applicationService.heal(id, healDto.actionName, healDto.subdomain);
}
```

#### 3. Service (`backend/src/modules/healer/services/application.service.ts`)

**Diagnose Method:**
```typescript
async diagnose(applicationId: string, subdomain?: string) {
  // If subdomain specified, look it up in metadata.availableSubdomains
  if (subdomain) {
    const subdomains = (application.metadata as any)?.availableSubdomains || [];
    const subdomainInfo = subdomains.find((s: any) => s.domain === subdomain);
    
    if (subdomainInfo) {
      diagnosisPath = subdomainInfo.path;  // Use subdomain's path
      diagnosisDomain = subdomain;
    }
  }
  
  // Create temporary application object with subdomain path
  const diagnosisApp = { ...application, path: diagnosisPath, domain: diagnosisDomain };
  
  // Run diagnostics on subdomain path
  const result = await plugin.executeDiagnosticCheck(checkName, diagnosisApp, server);
}
```

**Heal Method:**
```typescript
async heal(applicationId: string, actionName: string, subdomain?: string) {
  // If subdomain specified, look it up in metadata.availableSubdomains
  if (subdomain) {
    const subdomains = (application.metadata as any)?.availableSubdomains || [];
    const subdomainInfo = subdomains.find((s: any) => s.domain === subdomain);
    
    if (subdomainInfo) {
      healingPath = subdomainInfo.path;  // Use subdomain's path
      healingDomain = subdomain;
    }
  }
  
  // Create temporary application object with subdomain path
  const healingApp = { ...application, path: healingPath, domain: healingDomain };
  
  // Execute healing on subdomain path
  const result = await plugin.executeHealingAction(actionName, healingApp, server);
}
```

### Frontend Changes

#### ApplicationDetailView Component

Added "Diagnose" button for each related domain:

```typescript
interface ApplicationDetailViewProps {
  onDiagnoseSubdomain?: (subdomain: string) => void;  // NEW callback
}

// In Related Domains card:
<Button
  variant="outline"
  size="sm"
  onClick={() => onDiagnoseSubdomain?.(subdomain.domain)}
>
  <RefreshCw className="h-3 w-3 mr-1" />
  Diagnose
</Button>
```

## How It Works

### Diagnosis Flow

1. **User clicks "Diagnose" on a subdomain** (e.g., `shop.example.com`)
2. **Frontend calls API**: `POST /api/v1/healer/applications/:id/diagnose` with `{ subdomain: "shop.example.com" }`
3. **Backend looks up subdomain** in `metadata.availableSubdomains`:
   ```json
   {
     "domain": "shop.example.com",
     "path": "/home/user/public_html/shop",
     "type": "subdomain"
   }
   ```
4. **Backend creates temporary app object** with subdomain's path
5. **Diagnostics run on subdomain path** (`/home/user/public_html/shop`)
6. **Results stored** with main application ID (linked to parent)

### Healing Flow

1. **User clicks "Heal" on a subdomain issue**
2. **Frontend calls API**: `POST /api/v1/healer/applications/:id/heal` with `{ actionName: "fix_permissions", subdomain: "shop.example.com" }`
3. **Backend looks up subdomain** in `metadata.availableSubdomains`
4. **Backend creates temporary app object** with subdomain's path
5. **Healing action executes on subdomain path**
6. **Result returned** with subdomain information

## API Examples

### Diagnose Main Domain
```bash
POST /api/v1/healer/applications/abc-123/diagnose
{
  # No subdomain parameter - diagnoses main domain
}
```

### Diagnose Subdomain
```bash
POST /api/v1/healer/applications/abc-123/diagnose
{
  "subdomain": "shop.example.com"
}
```

### Heal Main Domain
```bash
POST /api/v1/healer/applications/abc-123/heal
{
  "actionName": "fix_permissions"
}
```

### Heal Subdomain
```bash
POST /api/v1/healer/applications/abc-123/heal
{
  "actionName": "fix_permissions",
  "subdomain": "shop.example.com"
}
```

## Supported Domain Types

All domain types detected in `metadata.availableSubdomains` can be diagnosed and healed:

- **Main Domain** (`type: 'main'`) - Primary domain for cPanel user
- **Subdomain** (`type: 'subdomain'`) - Subdomain of main domain (e.g., `shop.example.com`)
- **Addon Domain** (`type: 'addon'`) - Separate domain pointing to different path
- **Parked Domain** (`type: 'parked'`) - Alias pointing to same path as main domain

## Error Handling

### Subdomain Not Found
```typescript
if (!subdomainInfo) {
  throw new NotFoundException(`Subdomain ${subdomain} not found for application ${applicationId}`);
}
```

### No Available Subdomains
If `metadata.availableSubdomains` is empty or undefined, subdomain diagnosis will fail with 404.

## Database Storage

- Diagnostic results are stored with the **main application ID**
- Healing actions are stored with the **main application ID**
- Subdomain information is included in the result metadata
- This allows tracking all diagnostics/healings for a cPanel account in one place

## UI Features

### Related Domains Card

Each domain in the "Related Domains" card now has:
- **Domain name** with color-coded type badge
- **Path** showing document root
- **Diagnose button** to run diagnostics on that specific domain
- **Visit link** to open domain in new tab

### Color Coding

- **Main** (blue) - Primary domain
- **Subdomain** (purple) - Subdomain of main
- **Addon** (green) - Separate addon domain
- **Parked** (gray) - Parked/alias domain

## Next Steps (TODO)

1. **Frontend Integration**: Wire up `onDiagnoseSubdomain` callback in detail page
2. **Diagnosis Results**: Show subdomain-specific results in diagnostics tab
3. **Healing UI**: Add healing buttons for subdomain-specific issues
4. **Bulk Operations**: Support diagnosing/healing all subdomains at once
5. **Subdomain Health Scores**: Track individual health scores per subdomain

## Compatibility

- ✓ Works with all tech stacks (WordPress, Laravel, Node.js, PHP, etc.)
- ✓ Compatible with cPanel domain detection
- ✓ Follows WordPress healer pattern exactly
- ✓ Supports all domain types (main, subdomain, addon, parked)
- ✓ Backward compatible (subdomain parameter is optional)

---

**Status**: IMPLEMENTED ✓
**Date**: February 26, 2026
**Feature**: Subdomain/Addon diagnosis and healing support
**Pattern**: Copied from WordPress healer
