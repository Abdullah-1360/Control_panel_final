# WP Healer Subdomain and Multi-Domain Support

## Overview
The WP Healer now supports discovering and managing ALL domains associated with a cPanel account, including:
- Main domain (e.g., `example.com`)
- Subdomains (e.g., `blog.example.com`, `shop.example.com`)
- Addon domains (e.g., `anotherdomain.com`)
- Parked domains (aliases)

## Problem Solved

### Before
- Only discovered the PRIMARY domain for each cPanel user
- Missed subdomains and addon domains
- Users with multiple WordPress installations were only partially discovered
- Example: User has `example.com`, `blog.example.com`, and `shop.example.com` → Only `example.com` was discovered

### After
- Discovers ALL domains from `/etc/trueuserdomains`
- Correctly identifies document root for each domain
- Each domain is registered as a separate site
- Example: User has `example.com`, `blog.example.com`, and `shop.example.com` → All 3 are discovered

## How It Works

### 1. Domain Discovery Process

#### Step 1: Read All Domains
```bash
cat /etc/trueuserdomains
```

Output example:
```
example.com: username
blog.example.com: username
shop.example.com: username
addondomain.com: username
```

#### Step 2: Determine Document Root

For each domain, the system determines the correct document root:

**Main Domain:**
- Pattern: Domain matches username or starts with `username.`
- Path: `/home/username/public_html`
- Example: `example.com` → `/home/username/public_html`

**Subdomain:**
- Pattern: `subdomain.maindomain.com`
- Path: Retrieved from cPanel userdata or fallback to `/home/username/public_html/subdomain.maindomain.com`
- Example: `blog.example.com` → `/home/username/public_html/blog.example.com`

**Addon Domain:**
- Pattern: Different domain than main
- Path: Retrieved from cPanel userdata
- Example: `addondomain.com` → `/home/username/addondomain.com`

### 2. cPanel Userdata Lookup

For non-main domains, the system queries cPanel's userdata:

```bash
grep -E "^documentroot:" /var/cpanel/userdata/username/domain | cut -d: -f2- | xargs
```

This returns the exact document root configured in cPanel.

### 3. Fallback Strategy

If userdata lookup fails, the system uses intelligent fallbacks:
1. Try `/home/username/public_html/domain`
2. Try `/home/username/domain`
3. Use main public_html as last resort

## Implementation Details

### New Method: `getAllDomainsWithPaths()`

```typescript
private async getAllDomainsWithPaths(serverId: string): Promise<Array<{
  domain: string,
  path: string,
  username: string
}>>
```

**Returns:**
```typescript
[
  { domain: 'example.com', path: '/home/user/public_html', username: 'user' },
  { domain: 'blog.example.com', path: '/home/user/public_html/blog.example.com', username: 'user' },
  { domain: 'shop.example.com', path: '/home/user/public_html/shop.example.com', username: 'user' },
  { domain: 'addondomain.com', path: '/home/user/addondomain.com', username: 'user' }
]
```

### New Method: `getDomainDocumentRoot()`

```typescript
private async getDomainDocumentRoot(
  serverId: string,
  username: string,
  domain: string
): Promise<string | null>
```

Queries cPanel userdata to get the exact document root for a domain.

## Domain Types Explained

### 1. Main Domain
- The primary domain associated with the cPanel account
- Document root: `/home/username/public_html`
- Example: `example.com` for user `exampleuser`

### 2. Subdomain
- A subdomain of the main domain
- Document root: `/home/username/public_html/subdomain.maindomain.com`
- Example: `blog.example.com` → `/home/exampleuser/public_html/blog.example.com`

### 3. Addon Domain
- A completely different domain added to the account
- Document root: `/home/username/addondomain.com` (or custom path)
- Example: `anotherdomain.com` → `/home/exampleuser/anotherdomain.com`

### 4. Parked Domain
- An alias that points to another domain
- Same document root as the target domain
- Example: `example.net` parked on `example.com` → Same path as `example.com`

## Database Storage

Each domain is stored as a separate `WpSite` record:

```typescript
{
  id: 'uuid',
  domain: 'blog.example.com',
  path: '/home/username/public_html/blog.example.com',
  cPanelUsername: 'username',
  serverId: 'server-uuid',
  healthStatus: 'UNKNOWN',
  healingMode: 'MANUAL'
}
```

## Site-Scoped Commands

When executing commands for a subdomain, the system automatically scopes to the correct path:

```bash
# User selects: blog.example.com
# User types: ls -la
# System executes: cd /home/username/public_html/blog.example.com && ls -la
```

This ensures commands run in the correct subdomain directory, not the main domain.

## UI Considerations

### Site List Display
Each domain is shown as a separate card:
- `example.com` (Main)
- `blog.example.com` (Subdomain)
- `shop.example.com` (Subdomain)
- `addondomain.com` (Addon)

### Grouping (Future Enhancement)
Consider grouping domains by cPanel user:
```
📁 exampleuser
  ├─ example.com (Main)
  ├─ blog.example.com (Subdomain)
  ├─ shop.example.com (Subdomain)
  └─ addondomain.com (Addon)
```

## Common Scenarios

### Scenario 1: WordPress Multisite
- Main domain: `example.com` (multisite network)
- Subdomain: `site1.example.com` (mapped to multisite)
- Subdomain: `site2.example.com` (mapped to multisite)

**Handling:**
- Each subdomain is discovered separately
- Each can be diagnosed independently
- Healing actions respect the multisite structure

### Scenario 2: Separate WordPress Installations
- Main domain: `example.com` (WordPress blog)
- Subdomain: `shop.example.com` (WooCommerce store)
- Addon: `portfolio.com` (Portfolio site)

**Handling:**
- Each is a completely separate WordPress installation
- Each has its own database, plugins, themes
- Each can be healed independently

### Scenario 3: Development/Staging Subdomains
- Main domain: `example.com` (production)
- Subdomain: `dev.example.com` (development)
- Subdomain: `staging.example.com` (staging)

**Handling:**
- All three are discovered
- Can diagnose/heal each environment separately
- Prevents accidental healing of production when working on dev

## Edge Cases Handled

### 1. Wildcard Subdomains
- cPanel doesn't list wildcard subdomains in trueuserdomains
- Only explicitly created subdomains are discovered
- Wildcard requests are handled by the main domain

### 2. SSL Subdomains
- Subdomains with SSL certificates are discovered normally
- SSL status doesn't affect discovery

### 3. Redirected Subdomains
- Subdomains that redirect to other domains are still discovered
- Healing will work on the actual document root

### 4. Suspended Domains
- Suspended domains are still discovered
- Healing may fail if account is suspended

## Performance Considerations

### Discovery Speed
- Single SSH command to read trueuserdomains (fast)
- One additional command per non-main domain for userdata lookup
- Example: 10 domains = 1 + 9 = 10 SSH commands (still very fast)

### Database Impact
- More sites = more database records
- Pagination handles large numbers of sites
- Filtering by domain helps find specific sites

## Testing Checklist

- [x] Main domain discovered correctly
- [x] Subdomains discovered with correct paths
- [x] Addon domains discovered with correct paths
- [x] Parked domains discovered (same path as target)
- [x] Document root retrieved from cPanel userdata
- [x] Fallback paths work when userdata unavailable
- [x] Commands execute in correct subdomain directory
- [x] Each domain can be diagnosed independently
- [x] Each domain can be healed independently
- [x] Site list shows all domains

## Future Enhancements

### 1. Domain Type Badges
Show domain type in UI:
- 🏠 Main Domain
- 🌐 Subdomain
- ➕ Addon Domain
- 🔗 Parked Domain

### 2. Bulk Operations
- Diagnose all subdomains of a main domain
- Heal all sites for a cPanel user
- Update all sites to latest WordPress version

### 3. Domain Relationships
- Show parent-child relationships
- Group subdomains under main domain
- Show which domains share the same database

### 4. Smart Discovery
- Detect WordPress Multisite networks
- Identify staging/dev environments
- Suggest healing order (dev → staging → production)

## Related Files

- `backend/src/modules/healer/services/site-discovery.service.ts` - Main implementation
- `backend/src/modules/healer/services/manual-diagnosis.service.ts` - Site-scoped commands
- `backend/prisma/schema.prisma` - WpSite model

## Status

✅ Implemented and deployed
✅ All domain types discovered
✅ Correct document roots identified
✅ Site-scoped commands work for all domains
✅ Each domain manageable independently
