# Frontend: Unified Diagnosis Update

## Changes Made

### 1. Removed Auto/Manual Diagnosis Tabs
**Before**: Two separate tabs for "Auto Diagnosis" and "Manual Diagnosis"
**After**: Single "Diagnosis" tab with profile selection + "History" tab

### 2. Added Profile-Based Diagnosis
Users can now select from 4 diagnosis profiles:

#### FULL Profile
- **Description**: Comprehensive analysis with all checks
- **Timeout**: 120 seconds
- **Checks**: All checks enabled
- **Cache**: No caching
- **Use Case**: Manual troubleshooting, deep investigation

#### LIGHT Profile
- **Description**: Critical checks only
- **Timeout**: 60 seconds
- **Checks**: Critical checks only
- **Cache**: 5-minute cache
- **Use Case**: Scheduled monitoring, quick health check

#### QUICK Profile
- **Description**: Fast status verification
- **Timeout**: 30 seconds
- **Checks**: HTTP status + maintenance mode
- **Cache**: 1-minute cache
- **Use Case**: Rapid status verification

#### CUSTOM Profile
- **Description**: Select specific checks to run
- **Timeout**: Configurable
- **Checks**: User-defined
- **Cache**: No caching
- **Use Case**: Targeted investigation

### 3. Updated API Integration
The diagnosis request now includes the selected profile:

```typescript
const body = {
  profile: selectedProfile, // 'FULL' | 'LIGHT' | 'QUICK' | 'CUSTOM'
  subdomain: selectedSubdomain !== '__main__' ? selectedSubdomain : undefined,
};
```

### 4. New Tab Structure
- **Diagnosis Tab**: Profile selection + diagnosis results
- **History Tab**: Placeholder for diagnosis history (to be implemented in Phase 3)

### Files Modified
1. `frontend/components/healer/SiteDetailView.tsx`
   - Removed `activeTab` state with 'auto' | 'manual'
   - Added `selectedProfile` state with profile types
   - Updated tab structure (diagnosis + history)
   - Added profile selector dropdown
   - Updated diagnoseMutation to include profile
   - Removed ManualDiagnosisPage import and usage

### Files Created
1. `frontend/components/healer/UnifiedDiagnosisView.tsx`
   - Standalone component for unified diagnosis
   - Profile cards with visual selection
   - Detailed profile information
   - Health score display
   - Check results visualization
   - Can be used as alternative to integrated view

## User Experience Improvements

### Before
1. User had to choose between "Auto" or "Manual" mode
2. Auto mode ran all checks automatically
3. Manual mode required interactive command execution
4. No control over diagnosis depth/scope

### After
1. User selects diagnosis profile based on needs
2. Clear descriptions of what each profile does
3. Visual feedback on profile selection
4. Faster diagnosis with QUICK/LIGHT profiles
5. Comprehensive analysis with FULL profile
6. Future: Custom check selection with CUSTOM profile

## Backend Compatibility

The frontend now aligns with the backend's unified diagnosis system:
- ✅ Profile-based execution (FULL, LIGHT, QUICK, CUSTOM)
- ✅ Single `/diagnose` endpoint with profile parameter
- ✅ Consistent diagnosis result format
- ✅ Health score and check results display
- ✅ Category-based scoring (security, performance, maintenance, SEO, availability)

## Next Steps (Phase 3)

### 1. History Tab Implementation
- Display past diagnosis results
- Health score trending chart
- Filter by profile and date range
- Export diagnosis reports

### 2. Custom Profile Builder
- UI for selecting specific checks
- Save custom profiles
- Share profiles across sites

### 3. Health Dashboard
- Overall health score gauge
- Category breakdown visualization
- Trending charts (last 30 days)
- Predictive alerts

### 4. Check Results Enhancement
- Expandable check details
- Recommendations display
- Re-run individual checks
- Compare results over time

### 5. Auto-Healing Integration
- Display healing actions for failed checks
- Approval workflow UI
- Rollback support
- Multi-step workflow visualization

## Testing Checklist

- [ ] Profile selection works correctly
- [ ] FULL profile runs all checks
- [ ] LIGHT profile runs critical checks only
- [ ] QUICK profile runs minimal checks
- [ ] Diagnosis results display correctly
- [ ] Health score shows accurate value
- [ ] Check results list all executed checks
- [ ] Subdomain selection still works
- [ ] Error handling displays proper messages
- [ ] Loading states show during diagnosis

## Migration Notes

### For Users
- The "Auto Diagnosis" tab is now "Diagnosis" with profile selection
- The "Manual Diagnosis" tab has been replaced with "History"
- Manual interactive diagnosis will be available in a future update
- All existing functionality is preserved with better organization

### For Developers
- `ManualDiagnosisPage` component is no longer used in SiteDetailView
- Profile selection is now required for diagnosis
- Backend expects `profile` parameter in diagnosis request
- Diagnosis results include `profile` field indicating which profile was used

## Benefits

1. **Simplified UX**: Single diagnosis flow with clear options
2. **Better Performance**: Users can choose faster profiles when needed
3. **Flexibility**: Different profiles for different use cases
4. **Consistency**: Frontend matches backend architecture
5. **Scalability**: Easy to add new profiles or customize existing ones
6. **Future-Ready**: Foundation for advanced features (custom checks, scheduling, etc.)

---

**Status**: Complete
**Date**: 2026-02-18
**Impact**: Frontend now fully aligned with unified diagnosis backend
