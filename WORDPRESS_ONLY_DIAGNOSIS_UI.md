# WordPress-Only Diagnosis UI Update

## Status: ✅ COMPLETE

## Problem
The frontend allowed users to click "Run Diagnosis" on any application, regardless of tech stack. This caused errors when trying to diagnose non-WordPress sites:

```
BadRequestException: Tech stack is unknown for uzairfarooq.pk. 
Please detect the tech stack first using the "Detect Tech Stack" button, 
or manually override the tech stack in the configuration.
```

Users had no indication that only WordPress sites are supported for diagnosis.

## Solution
Updated all diagnosis UI components to:
1. Disable "Run Diagnosis" button for non-WordPress sites
2. Show helpful tooltip explaining WordPress-only support
3. Display warning notice for non-WordPress sites
4. Provide clear guidance on what to do next

## Changes Made

### 1. ApplicationDetailView-v2.tsx (Domain Cards)
**Location:** `frontend/components/healer/ApplicationDetailView-v2.tsx`

**Changes:**
- Disabled button when `techStack !== 'WORDPRESS'`
- Added tooltip: "Only WordPress sites are supported for diagnosis"
- Added helper text below button for non-WordPress sites

```tsx
<Button 
  onClick={onDiagnose} 
  disabled={isLoading || techStack !== 'WORDPRESS'} 
  size="sm"
  title={techStack !== 'WORDPRESS' ? 'Only WordPress sites are supported for diagnosis' : 'Run comprehensive health diagnosis'}
>
  <RefreshCw className="h-4 w-4 mr-2" />
  Run Diagnosis
</Button>

{techStack !== 'WORDPRESS' && (
  <p className="text-xs text-muted-foreground w-full">
    Only WordPress sites are supported for diagnosis currently
  </p>
)}
```

### 2. DiagnosePage.tsx (Diagnosis Page)
**Location:** `frontend/components/healer/DiagnosePage.tsx`

**Changes:**
- Disabled button when `application.techStack !== 'WORDPRESS'`
- Added tooltip
- Added prominent warning card for non-WordPress sites

```tsx
<Button 
  onClick={handleRunDiagnosis} 
  disabled={isRunning || application.techStack !== 'WORDPRESS'}
  title={application.techStack !== 'WORDPRESS' ? 'Only WordPress sites are supported for diagnosis' : 'Run comprehensive health diagnosis'}
>
  <RefreshCw className={cn('h-4 w-4 mr-2', isRunning && 'animate-spin')} />
  {isRunning ? 'Running...' : 'Run Diagnosis'}
</Button>

{/* WordPress-only notice */}
{application.techStack !== 'WORDPRESS' && (
  <Card className="border-yellow-200 bg-yellow-50">
    <CardContent className="pt-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
        <div>
          <p className="font-medium text-yellow-900">WordPress Sites Only</p>
          <p className="text-sm text-yellow-700 mt-1">
            Diagnosis is currently only supported for WordPress sites. 
            {application.techStack === 'UNKNOWN' && ' Please detect the tech stack first.'}
            {application.techStack !== 'UNKNOWN' && application.techStack !== 'WORDPRESS' && ' Support for other platforms is coming soon.'}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

### 3. UniversalHealerView.tsx (Main Healer View)
**Location:** `frontend/components/healer/UniversalHealerView.tsx`

**Changes:**
- Disabled button when `selectedApplication.techStack !== 'WORDPRESS'`
- Added tooltip

```tsx
<Button 
  variant="outline" 
  size="sm" 
  onClick={handleDiagnose} 
  disabled={diagnoseMutation.isPending || selectedApplication.techStack !== 'WORDPRESS'}
  title={selectedApplication.techStack !== 'WORDPRESS' ? 'Only WordPress sites are supported for diagnosis' : 'Run comprehensive health diagnosis'}
>
  <AlertCircle className="h-4 w-4 mr-2" />
  Run Diagnosis
</Button>
```

### 4. Diagnose Page (Route)
**Location:** `frontend/src/app/(dashboard)/healer/sites/[id]/diagnose/page.tsx`

**Changes:**
- Disabled button when `site?.techStack !== 'WORDPRESS'`
- Added tooltip
- Added Alert component with detailed message

```tsx
<Button
  onClick={handleDiagnose}
  disabled={diagnoseMutation.isPending || site?.techStack !== 'WORDPRESS'}
  title={site?.techStack !== 'WORDPRESS' ? 'Only WordPress sites are supported for diagnosis' : 'Run comprehensive health diagnosis'}
>
  {diagnoseMutation.isPending && (
    <Activity className="mr-2 h-4 w-4 animate-spin" />
  )}
  Run Diagnosis
</Button>

{/* WordPress-only notice */}
{site && site.techStack !== 'WORDPRESS' && (
  <Alert className="border-yellow-200 bg-yellow-50">
    <AlertCircle className="h-4 w-4 text-yellow-600" />
    <AlertTitle className="text-yellow-900">WordPress Sites Only</AlertTitle>
    <AlertDescription className="text-yellow-700">
      Diagnosis is currently only supported for WordPress sites.
      {site.techStack === 'UNKNOWN' && ' Please detect the tech stack first.'}
      {site.techStack !== 'UNKNOWN' && site.techStack !== 'WORDPRESS' && ' Support for other platforms is coming soon.'}
    </AlertDescription>
  </Alert>
)}
```

## User Experience

### Scenario 1: WordPress Site
- Button: **Enabled** ✓
- Tooltip: "Run comprehensive health diagnosis"
- Notice: None
- Action: Diagnosis runs successfully

### Scenario 2: UNKNOWN Tech Stack
- Button: **Disabled** ✗
- Tooltip: "Only WordPress sites are supported for diagnosis"
- Notice: "WordPress Sites Only - Please detect the tech stack first."
- Action: User must click "Detect Tech Stack" first

### Scenario 3: Non-WordPress Site (Laravel, Node.js, etc.)
- Button: **Disabled** ✗
- Tooltip: "Only WordPress sites are supported for diagnosis"
- Notice: "WordPress Sites Only - Support for other platforms is coming soon."
- Action: User understands diagnosis is not available yet

## Visual Design

### Warning Card Style
- Border: Yellow (border-yellow-200)
- Background: Light yellow (bg-yellow-50)
- Icon: AlertCircle in yellow (text-yellow-600)
- Title: Dark yellow (text-yellow-900)
- Description: Medium yellow (text-yellow-700)

### Button States
- **Enabled:** Default blue button
- **Disabled:** Grayed out, cursor not-allowed
- **Hover (enabled):** Shows tooltip with explanation
- **Hover (disabled):** Shows tooltip explaining why disabled

## Error Prevention

### Before This Update
1. User clicks "Run Diagnosis" on UNKNOWN site
2. Backend throws error
3. Error logged in console
4. User sees generic error message
5. User confused about what went wrong

### After This Update
1. User sees disabled button
2. User hovers → sees tooltip
3. User sees warning notice with clear explanation
4. User knows exactly what to do (detect tech stack or wait for support)
5. No errors, no confusion

## Future Enhancements

### Phase 1: WordPress Only (Current)
- ✅ Only WordPress sites can run diagnosis
- ✅ Clear UI indication
- ✅ Helpful error messages

### Phase 2: Multi-Platform Support (Future)
- [ ] Laravel diagnosis support
- [ ] Node.js diagnosis support
- [ ] PHP Generic diagnosis support
- [ ] Update UI to show "Coming Soon" badges
- [ ] Add waitlist for platform-specific diagnosis

### Phase 3: Custom Diagnosis (Future)
- [ ] Allow users to create custom diagnosis checks
- [ ] Platform-agnostic health checks
- [ ] User-defined thresholds and alerts

## Testing Checklist

### Manual Testing Required
- [ ] WordPress site → Button enabled, no warning
- [ ] UNKNOWN site → Button disabled, warning shows "detect tech stack first"
- [ ] Laravel site → Button disabled, warning shows "coming soon"
- [ ] Node.js site → Button disabled, warning shows "coming soon"
- [ ] PHP Generic site → Button disabled, warning shows "coming soon"
- [ ] Hover over disabled button → Tooltip shows
- [ ] Hover over enabled button → Tooltip shows
- [ ] Click disabled button → Nothing happens
- [ ] Click enabled button → Diagnosis runs

### Expected Behavior
- ✅ No errors in console for non-WordPress sites
- ✅ Clear visual feedback for all tech stacks
- ✅ Consistent messaging across all components
- ✅ Accessible (keyboard navigation, screen readers)

## Files Modified
1. `frontend/components/healer/ApplicationDetailView-v2.tsx`
2. `frontend/components/healer/DiagnosePage.tsx`
3. `frontend/components/healer/UniversalHealerView.tsx`
4. `frontend/src/app/(dashboard)/healer/sites/[id]/diagnose/page.tsx`

## Backend Protection
The backend already has protection against non-WordPress diagnosis:

```typescript
// backend/src/modules/healer/services/application.service.ts
if (diagnosisApp.techStack === TechStack.UNKNOWN) {
  throw new BadRequestException(
    `Tech stack is unknown for ${diagnosisDomain}. ` +
    `Please detect the tech stack first using the "Detect Tech Stack" button, ` +
    `or manually override the tech stack in the configuration.`
  );
}
```

This frontend update provides a better user experience by preventing the error before it happens.

## Summary
Users now have clear visual feedback that diagnosis is only supported for WordPress sites. The UI prevents errors by disabling the button and showing helpful messages, improving the overall user experience.
