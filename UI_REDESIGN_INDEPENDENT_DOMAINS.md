# UI/UX Redesign: Independent Domain Management

## Overview

Redesigned the Application Detail View to treat each domain (main, subdomain, addon, parked) as an independent entity with its own:
- Tech stack detection
- Health score and status
- Diagnosis results
- Healing enable/disable toggle
- Configuration settings

## Design Rationale

### Problem
Previously, all domains under one cPanel account were treated as a single application. However:
- Main domain might be WordPress
- Subdomain could be Laravel
- Addon domain could be Node.js
- Each needs independent monitoring and healing

### Solution
Each domain is now displayed as a separate card with:
- Expandable/collapsible view
- Individual health metrics
- Independent healer controls
- Separate diagnosis and configuration

## New UI Components

### 1. Domain Card Component

Each domain gets its own card with:

**Header (Always Visible):**
- Expand/collapse button
- Domain name
- Domain type badge (Main, Subdomain, Addon, Parked)
- Tech stack badge (WordPress, Laravel, Node.js, etc.)
- Health status badge (Healthy, Degraded, Down, etc.)
- Health score (large number)

**Expanded Content:**
- Document root path
- Version information (tech stack version, PHP version)
- Database name
- Health score progress bar
- Auto Healer toggle (Enable/Disable)
- Action buttons (Diagnose, Configure, Visit Site)

### 2. Visual Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│ Server Info Header                                       │
│ [Server Name] • [Host] • [Platform]        [Delete]     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Main Domain                                              │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [>] 🌐 example.com [Primary]                        │ │
│ │     [Main Domain] [WordPress] [Healthy]    95%      │ │
│ │                                                      │ │
│ │ [Expanded Content]                                  │ │
│ │ • Document Root: /home/user/public_html             │ │
│ │ • Version: 6.4.2                                    │ │
│ │ • PHP: 8.1.2                                        │ │
│ │ • Health: [████████████████████░] 95%               │ │
│ │ • Auto Healer: [Enabled] [Disable]                  │ │
│ │ • [Diagnose] [Configure] [Visit Site]               │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Related Domains                              [3 domains] │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [>] 🌐 shop.example.com                             │ │
│ │     [Subdomain] [Laravel] [Degraded]       72%      │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [>] 🌐 blog.example.com                             │ │
│ │     [Subdomain] [WordPress] [Healthy]      88%      │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [>] 🌐 addon-domain.com                             │ │
│ │     [Addon Domain] [Node.js] [Unknown]     0%       │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Color Coding

### Domain Types
- **Main Domain** (Blue): 🏠 Primary domain for cPanel account
- **Subdomain** (Purple): 🔗 Subdomain of main domain
- **Addon Domain** (Green): ➕ Separate domain with own path
- **Parked Domain** (Gray): 🅿️ Alias pointing to main domain

### Tech Stacks
- **WordPress** (Blue): 🔷
- **Laravel** (Red): 🔴
- **Node.js** (Green): 🟢
- **Next.js** (Gray): ⚫
- **Express** (Yellow): 🟡
- **PHP Generic** (Purple): 🟣

### Health Status
- **Healthy** (Green): 90-100%
- **Degraded** (Yellow): 70-89%
- **Down** (Red): 0-69%
- **Maintenance** (Blue): Manual maintenance mode
- **Healing** (Orange): Auto-healing in progress
- **Unknown** (Gray): Not yet diagnosed

## Features

### 1. Expandable Cards
- **Collapsed**: Shows essential info (domain, type, tech stack, health score)
- **Expanded**: Shows full details and controls
- **Main domain**: Expanded by default
- **Related domains**: Collapsed by default

### 2. Independent Healer Controls
Each domain has its own:
- **Enable/Disable toggle**: Turn auto-healing on/off per domain
- **Healing mode**: Manual, Semi-Auto, Full-Auto (future)
- **Healing history**: Track healing actions per domain

### 3. Individual Diagnosis
- **Diagnose button**: Run diagnostics on specific domain
- **Results**: Stored and displayed per domain
- **History**: Track diagnosis history per domain

### 4. Separate Configuration
- **Configure button**: Open settings for specific domain
- **Tech stack settings**: Configure based on detected tech stack
- **Healing rules**: Set domain-specific healing rules

## Data Structure

### Backend Storage

Each subdomain's metadata is stored in `metadata.availableSubdomains`:

```json
{
  "availableSubdomains": [
    {
      "domain": "shop.example.com",
      "path": "/home/user/public_html/shop",
      "type": "subdomain",
      "techStack": "LARAVEL",
      "version": "10.x",
      "phpVersion": "8.2",
      "healthScore": 72,
      "healthStatus": "DEGRADED",
      "isHealerEnabled": true,
      "lastDiagnosed": "2026-02-26T10:30:00Z"
    }
  ]
}
```

### Future Enhancement: Separate Table

For better scalability, consider moving subdomains to separate table:

```sql
CREATE TABLE application_domains (
  id UUID PRIMARY KEY,
  application_id UUID REFERENCES applications(id),
  domain VARCHAR(255) NOT NULL,
  path TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- main, subdomain, addon, parked
  tech_stack VARCHAR(50),
  tech_stack_version VARCHAR(50),
  health_score INTEGER DEFAULT 0,
  health_status VARCHAR(50) DEFAULT 'UNKNOWN',
  is_healer_enabled BOOLEAN DEFAULT false,
  healing_mode VARCHAR(50) DEFAULT 'MANUAL',
  metadata JSONB,
  last_diagnosed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## User Workflows

### Workflow 1: View All Domains
1. User clicks "View Details" on application
2. Main domain card shown expanded
3. Related domains shown collapsed
4. User can see health scores at a glance

### Workflow 2: Diagnose Specific Domain
1. User expands subdomain card
2. Clicks "Diagnose" button
3. Backend runs diagnostics on subdomain path
4. Results displayed in subdomain card
5. Health score updated

### Workflow 3: Enable Healing for Subdomain
1. User expands subdomain card
2. Clicks "Enable" on Auto Healer toggle
3. Backend enables healing for that subdomain
4. Subdomain monitored independently
5. Auto-healing runs when issues detected

### Workflow 4: Configure Domain-Specific Settings
1. User expands domain card
2. Clicks "Configure" button
3. Opens configuration modal for that domain
4. User sets domain-specific rules
5. Settings saved per domain

## API Changes Needed

### 1. Store Subdomain Metadata
```typescript
// Update subdomain metadata
PUT /api/v1/healer/applications/:id/subdomains/:domain
{
  "techStack": "LARAVEL",
  "isHealerEnabled": true,
  "healingMode": "SEMI_AUTO"
}
```

### 2. Get Subdomain Diagnostics
```typescript
// Get diagnostics for specific subdomain
GET /api/v1/healer/applications/:id/diagnostics?subdomain=shop.example.com
```

### 3. Toggle Subdomain Healer
```typescript
// Enable/disable healer for subdomain
POST /api/v1/healer/applications/:id/subdomains/:domain/toggle-healer
{
  "enabled": true
}
```

## Implementation Steps

### Phase 1: UI Update (Current)
- ✅ Create new ApplicationDetailView-v2 component
- ✅ Implement DomainCard component
- ✅ Add expand/collapse functionality
- ✅ Add independent healer toggles
- ✅ Add per-domain action buttons

### Phase 2: Backend Support (Next)
- [ ] Add subdomain metadata update endpoint
- [ ] Store subdomain-specific settings
- [ ] Track subdomain health scores separately
- [ ] Store subdomain diagnosis results separately

### Phase 3: Full Integration
- [ ] Wire up subdomain healer toggle
- [ ] Implement subdomain configuration modal
- [ ] Show subdomain-specific diagnosis results
- [ ] Add subdomain healing history

### Phase 4: Advanced Features
- [ ] Bulk operations (diagnose all, enable all)
- [ ] Domain comparison view
- [ ] Cross-domain dependency detection
- [ ] Unified dashboard for all domains

## Benefits

### 1. Clarity
- Each domain clearly separated
- No confusion about which domain is being managed
- Visual hierarchy shows relationships

### 2. Flexibility
- Configure each domain independently
- Different tech stacks supported
- Different healing strategies per domain

### 3. Scalability
- Easy to add more domains
- Performance: Only load expanded domain details
- Can handle 10+ domains per account

### 4. User Experience
- Intuitive expand/collapse
- Quick health overview
- Easy access to common actions
- Clear visual feedback

## Migration Path

### For Existing Users
1. Main domain data remains unchanged
2. Subdomain data populated from `metadata.availableSubdomains`
3. Default values for missing subdomain data
4. Gradual migration as users view details

### Backward Compatibility
- Old API endpoints still work
- New endpoints are additive
- Frontend gracefully handles missing data
- Progressive enhancement approach

---

**Status**: DESIGNED ✓
**Date**: February 26, 2026
**Component**: ApplicationDetailView-v2.tsx
**Next Steps**: Backend API support for subdomain-specific operations
