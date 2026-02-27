# Domain Filtering Fix - Universal Healer

## Problem

Discovery was registering invalid entries like "css", "site-data", "site-admin" as applications. These are subdirectory names that appear in `/etc/trueuserdomains` but are NOT actual domains.

## Root Cause

The `/etc/trueuserdomains` file contains entries like:
```
example.com: username
css: username
site-data: username
site-admin: username
sub.example.com: username
```

The discovery was registering ALL entries without validating if they are actual domains.

## Solution

Added domain validation in `discoverViaCPanel()` method:

```typescript
// CRITICAL FILTER: Only register if domain looks valid (has a dot)
// This filters out subdirectory entries like "css", "site-data", "site-admin"
if (!domain.includes('.')) {
  this.logger.debug(`Skipping non-domain entry: ${domain} (no dot found)`);
  filtered++;
  continue;
}
```

## Logic

Valid domains MUST contain at least one dot:
- ✓ `example.com` (valid)
- ✓ `sub.example.com` (valid subdomain)
- ✓ `addon-domain.net` (valid addon)
- ✗ `css` (invalid - no dot)
- ✗ `site-data` (invalid - no dot)
- ✗ `site-admin` (invalid - no dot)

## Implementation Details

1. **getAllDomainsWithPaths()**: Returns ALL entries from trueuserdomains (no filtering)
2. **discoverViaCPanel()**: Filters during registration (only domains with dots)
3. **Logging**: Tracks filtered count separately from skipped/updated

## Expected Results

### Before Fix
- Discovers ~237 applications
- Includes invalid entries: "css", "site-data", "site-admin", "Insurance", etc.
- User sees non-domain entries in application list

### After Fix
- Discovers ~200 applications (actual cPanel accounts)
- Only valid domains with dots: "example.com", "sub.example.com", "addon.net"
- No subdirectory entries in application list

## Testing

1. **Clear existing applications**:
   ```bash
   cd backend
   npx ts-node scripts/clear-applications.ts
   ```

2. **Run discovery** (via UI):
   - Click "Discover Applications"
   - Should discover ~200 applications
   - Should NOT see "css", "site-data", "site-admin"

3. **Check logs**:
   ```bash
   # Should see:
   # - "Found X entries in trueuserdomains"
   # - "Skipping non-domain entry: css (no dot found)"
   # - "Skipping non-domain entry: site-data (no dot found)"
   # - "cPanel discovery complete: X applications registered (Y filtered out)"
   ```

## Files Modified

- `backend/src/modules/healer/services/application.service.ts`:
  - Added domain validation in `discoverViaCPanel()`
  - Added `filtered` counter to track skipped non-domains
  - Updated logging to show filtered count

## Compatibility

- ✓ Works with all valid domains (main, subdomain, addon, parked)
- ✓ Filters out subdirectory entries
- ✓ Maintains performance (no additional SSH calls)
- ✓ Follows WordPress healer pattern (same filtering logic)

---

**Status**: IMPLEMENTED ✓
**Date**: February 26, 2026
**Issue**: Non-domain entries being registered as applications
**Solution**: Domain validation (must contain dot)
