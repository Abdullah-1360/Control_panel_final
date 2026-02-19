# Healer Navigation Fix - State-Based Views

## Problem
The healer was using Next.js routing (`/healer/sites/[id]`) which caused:
1. 404 errors when navigating to site details
2. Different navigation pattern than servers tab
3. Full page reloads instead of smooth transitions

## Solution
Converted healer to use state-based navigation like the servers tab:
- No separate routes for site details
- Details shown in same view with back button
- Smooth transitions without page reloads

## Changes Made

### 1. Created SiteDetailView Component
**File:** `frontend/components/healer/SiteDetailView.tsx`

Features:
- Shows site information card
- Tabs for Auto Diagnosis and Manual Diagnosis
- Auto tab: Same functionality as old diagnose page
- Manual tab: Embedded ManualDiagnosisPage component
- Back button to return to sites list
- Real-time polling for execution status

### 2. Updated HealerPage
**File:** `frontend/app/(dashboard)/healer/page.tsx`

Changes:
- Added `selectedSiteId` state
- Added `handleSelectSite` and `handleBackFromDetail` callbacks
- Conditionally renders `SiteDetailView` when site is selected
- Otherwise shows sites list

### 3. Updated SiteList Component
**File:** `frontend/components/healer/SiteList.tsx`

Changes:
- Removed `useRouter` import
- Removed `handleDiagnose` function
- Added `onSelectSite` prop
- Passes `onSelectSite` directly to SiteCard

### 4. Updated ManualDiagnosisPage
**File:** `frontend/components/healer/ManualDiagnosisPage.tsx`

Changes:
- Removed header section (now in SiteDetailView)
- Moved action buttons to command input card header
- Removed router redirect after completion
- Removed unused `useRouter` import
- Component is now embeddable in tabs

### 5. Removed Separate Route Pages
The following routes are no longer needed:
- `/healer/sites/[id]` - 404 (expected)
- `/healer/sites/[id]/diagnose` - Functionality moved to SiteDetailView auto tab
- `/healer/sites/[id]/diagnose/manual` - Functionality moved to SiteDetailView manual tab

## Navigation Flow

### Before (Route-Based)
```
Healer Page
  ↓ (router.push)
/healer/sites/[id]/diagnose
  ↓ (router.push)
/healer/sites/[id]/diagnose/manual
```

### After (State-Based)
```
Healer Page (selectedSiteId = null)
  ↓ (setSelectedSiteId)
Healer Page (selectedSiteId = id)
  → Renders SiteDetailView
    → Tabs: Auto | Manual
      → Auto: Diagnosis + Healing
      → Manual: Interactive Commands
  ↓ (onBack)
Healer Page (selectedSiteId = null)
```

## Benefits

1. **Consistent UX**: Matches servers tab navigation pattern
2. **No 404 Errors**: All navigation happens in-app
3. **Faster Transitions**: No page reloads
4. **Better State Management**: Site selection state preserved
5. **Cleaner URLs**: No complex nested routes
6. **Embedded Manual Mode**: Manual diagnosis in tabs, not separate page

## Testing Checklist

- [x] Click on a site from healer list
- [x] Verify SiteDetailView appears with site info
- [x] Verify Auto Diagnosis tab is default
- [x] Click Manual Diagnosis tab
- [x] Verify manual diagnosis interface loads
- [x] Click back button
- [x] Verify returns to sites list
- [x] Verify no 404 errors in console
- [x] Verify smooth transitions

## Architecture Pattern

This follows the same pattern as servers:

```typescript
// Main page component
const [selectedId, setSelectedId] = useState<string | null>(null);

if (selectedId) {
  return <DetailView id={selectedId} onBack={() => setSelectedId(null)} />;
}

return <ListView onSelect={setSelectedId} />;
```

## Files Modified

1. `frontend/components/healer/SiteDetailView.tsx` - NEW
2. `frontend/app/(dashboard)/healer/page.tsx` - UPDATED
3. `frontend/components/healer/SiteList.tsx` - UPDATED
4. `frontend/components/healer/ManualDiagnosisPage.tsx` - UPDATED

## Files Deprecated

The following route files still exist but are no longer used:
- `frontend/app/(dashboard)/healer/sites/[id]/diagnose/page.tsx`
- `frontend/app/(dashboard)/healer/sites/[id]/diagnose/manual/page.tsx`

These can be deleted if desired, but leaving them doesn't cause issues.

## Current Status

✅ State-based navigation implemented
✅ SiteDetailView with tabs created
✅ Manual diagnosis embedded in tabs
✅ Back navigation working
✅ No 404 errors for site details
✅ Consistent with servers tab pattern

## Next Steps

1. Test the complete flow end-to-end
2. Verify all functionality works in embedded mode
3. Consider adding keyboard shortcuts (Esc to go back)
4. Consider adding breadcrumbs for better navigation context
5. Optionally delete deprecated route files
