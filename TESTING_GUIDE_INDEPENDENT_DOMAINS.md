# Testing Guide: Independent Domain Management

## Overview

This guide provides step-by-step instructions for testing the new independent domain management feature in the Universal Healer.

---

## Prerequisites

1. Backend server running on port 3001
2. Frontend server running on port 3000
3. At least one cPanel server configured
4. At least one application with subdomains/addon domains discovered

---

## Test Scenarios

### Scenario 1: View Application with Multiple Domains

**Objective**: Verify that all domains are displayed correctly

**Steps**:
1. Navigate to Healer page (`/healer`)
2. Click "View Details" on any application
3. Verify main domain card is expanded by default
4. Verify related domains are shown collapsed
5. Verify each domain shows:
   - Domain name
   - Domain type badge (Main, Subdomain, Addon, Parked)
   - Tech stack badge
   - Health status badge
   - Health score percentage

**Expected Result**:
- Main domain card is expanded
- Related domains are collapsed
- All badges show correct colors
- Health scores display correctly

---

### Scenario 2: Expand/Collapse Domain Cards

**Objective**: Verify expand/collapse functionality works

**Steps**:
1. On application detail page
2. Click chevron icon on a collapsed domain card
3. Verify card expands to show full details
4. Click chevron icon again
5. Verify card collapses

**Expected Result**:
- Card expands smoothly
- All details visible when expanded
- Card collapses smoothly
- Chevron icon rotates correctly

---

### Scenario 3: Diagnose Main Application

**Objective**: Verify main application diagnosis works

**Steps**:
1. On application detail page
2. Expand main domain card (if collapsed)
3. Click "Run Diagnosis" button
4. Wait for diagnosis to complete
5. Verify toast notification shows "Diagnosis Started"
6. Navigate to "Diagnostics" tab
7. Verify diagnostic results are displayed

**Expected Result**:
- Diagnosis starts successfully
- Toast notification appears
- Diagnostic results show in Diagnostics tab
- Health score updates after diagnosis

---

### Scenario 4: Diagnose Subdomain

**Objective**: Verify subdomain diagnosis works independently

**Steps**:
1. On application detail page
2. Expand a subdomain card
3. Click "Run Diagnosis" button on subdomain
4. Wait for diagnosis to complete
5. Verify toast notification shows "Running diagnostics on [subdomain]"
6. Check that subdomain health score updates

**Expected Result**:
- Diagnosis runs on subdomain path
- Toast shows subdomain name
- Subdomain health score updates
- Main domain health score unchanged

---

### Scenario 5: Toggle Main Application Healer

**Objective**: Verify main application healer toggle works

**Steps**:
1. On application detail page
2. Expand main domain card
3. Note current healer status (Enabled/Disabled)
4. Click healer toggle button
5. Verify toast notification shows status change
6. Refresh page
7. Verify healer status persisted

**Expected Result**:
- Healer toggles successfully
- Toast notification appears
- Status persists after refresh
- Button text updates (Enable ↔ Disable)

---

### Scenario 6: Toggle Subdomain Healer

**Objective**: Verify subdomain healer toggle works independently

**Steps**:
1. On application detail page
2. Expand a subdomain card
3. Note current healer status
4. Click healer toggle button on subdomain
5. Verify toast notification shows status change for subdomain
6. Refresh page
7. Verify subdomain healer status persisted
8. Verify main domain healer status unchanged

**Expected Result**:
- Subdomain healer toggles successfully
- Toast shows subdomain name
- Status persists after refresh
- Main domain healer status unchanged

---

### Scenario 7: Visit Domain Site

**Objective**: Verify "Visit Site" button works for each domain

**Steps**:
1. On application detail page
2. Expand any domain card
3. Click "Visit Site" button
4. Verify new tab opens with domain URL

**Expected Result**:
- New tab opens
- Correct domain URL loaded
- Site loads successfully (if accessible)

---

### Scenario 8: Configure Domain (Placeholder)

**Objective**: Verify configure button shows placeholder

**Steps**:
1. On application detail page
2. Expand any domain card
3. Click "Configure" button
4. Verify toast notification shows "Coming Soon"

**Expected Result**:
- Toast notification appears
- Message says configuration coming soon
- No errors in console

---

### Scenario 9: Multiple Subdomains

**Objective**: Verify UI handles many domains gracefully

**Steps**:
1. Find application with 5+ domains
2. Navigate to detail page
3. Verify all domains display correctly
4. Expand multiple domains
5. Verify no performance issues
6. Verify scrolling works smoothly

**Expected Result**:
- All domains display correctly
- No layout issues
- Smooth scrolling
- No performance degradation

---

### Scenario 10: Domain Type Colors

**Objective**: Verify domain type badges show correct colors

**Steps**:
1. On application detail page
2. Verify main domain badge is blue
3. Verify subdomain badges are purple
4. Verify addon domain badges are green
5. Verify parked domain badges are gray

**Expected Result**:
- Main domain: Blue badge with 🏠 icon
- Subdomain: Purple badge with 🔗 icon
- Addon: Green badge with ➕ icon
- Parked: Gray badge with 🅿️ icon

---

### Scenario 11: Tech Stack Colors

**Objective**: Verify tech stack badges show correct colors

**Steps**:
1. On application detail page
2. Check WordPress domains show blue badge
3. Check Laravel domains show red badge
4. Check Node.js domains show green badge
5. Check PHP Generic domains show purple badge

**Expected Result**:
- WordPress: Blue badge with 🔷 icon
- Laravel: Red badge with 🔴 icon
- Node.js: Green badge with 🟢 icon
- Next.js: Gray badge with ⚫ icon
- Express: Yellow badge with 🟡 icon
- PHP Generic: Purple badge with 🟣 icon

---

### Scenario 12: Health Status Colors

**Objective**: Verify health status badges show correct colors

**Steps**:
1. On application detail page
2. Check domains with 90-100% health show green "HEALTHY"
3. Check domains with 70-89% health show yellow "DEGRADED"
4. Check domains with 0-69% health show red "DOWN"
5. Check undiagnosed domains show gray "UNKNOWN"

**Expected Result**:
- Healthy (90-100%): Green badge
- Degraded (70-89%): Yellow badge
- Down (0-69%): Red badge
- Unknown: Gray badge

---

### Scenario 13: Delete Application

**Objective**: Verify delete functionality still works

**Steps**:
1. On application detail page
2. Click "Delete Application" button
3. Confirm deletion in dialog
4. Verify redirect to applications list
5. Verify application no longer appears

**Expected Result**:
- Confirmation dialog appears
- Application deleted successfully
- Redirects to list page
- Application removed from list

---

### Scenario 14: API Error Handling

**Objective**: Verify errors are handled gracefully

**Steps**:
1. Stop backend server
2. Try to toggle subdomain healer
3. Verify error toast appears
4. Restart backend server
5. Try operation again
6. Verify it works

**Expected Result**:
- Error toast shows meaningful message
- No console errors
- UI remains functional
- Operation works after server restart

---

### Scenario 15: Concurrent Operations

**Objective**: Verify multiple operations can run simultaneously

**Steps**:
1. On application detail page
2. Expand multiple domain cards
3. Click diagnose on main domain
4. Immediately click diagnose on subdomain
5. Verify both operations complete
6. Check both health scores update

**Expected Result**:
- Both diagnoses run successfully
- No race conditions
- Both health scores update
- No errors in console

---

## API Testing

### Test 1: Update Subdomain Metadata

```bash
curl -X PUT http://localhost:3001/api/v1/healer/applications/{id}/subdomains/{domain} \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "techStack": "LARAVEL",
    "isHealerEnabled": true,
    "healthScore": 85
  }'
```

**Expected Response**:
```json
{
  "applicationId": "uuid",
  "subdomain": "shop.example.com",
  "message": "Subdomain metadata updated successfully",
  "data": {
    "domain": "shop.example.com",
    "techStack": "LARAVEL",
    "isHealerEnabled": true,
    "healthScore": 85,
    "updatedAt": "2026-02-26T..."
  }
}
```

### Test 2: Toggle Subdomain Healer

```bash
curl -X POST http://localhost:3001/api/v1/healer/applications/{id}/subdomains/{domain}/toggle-healer \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true
  }'
```

**Expected Response**:
```json
{
  "applicationId": "uuid",
  "subdomain": "shop.example.com",
  "isHealerEnabled": true,
  "message": "Healer enabled successfully"
}
```

### Test 3: Get Subdomain Diagnostics

```bash
curl -X GET http://localhost:3001/api/v1/healer/applications/{id}/subdomains/{domain}/diagnostics?limit=10 \
  -H "Authorization: Bearer {token}"
```

**Expected Response**:
```json
{
  "applicationId": "uuid",
  "subdomain": "shop.example.com",
  "results": [
    {
      "id": "uuid",
      "checkName": "file_permissions",
      "status": "PASS",
      "severity": "MEDIUM",
      "message": "File permissions are correct",
      "createdAt": "2026-02-26T..."
    }
  ]
}
```

---

## Performance Testing

### Test 1: Load Time with Many Domains

**Objective**: Verify page loads quickly with 10+ domains

**Steps**:
1. Create application with 10+ domains
2. Navigate to detail page
3. Measure page load time
4. Verify < 2 seconds

**Expected Result**:
- Page loads in < 2 seconds
- All domains render correctly
- No layout shift

### Test 2: Expand/Collapse Performance

**Objective**: Verify smooth animations with many domains

**Steps**:
1. On page with 10+ domains
2. Rapidly expand/collapse multiple cards
3. Verify smooth animations
4. Check CPU usage

**Expected Result**:
- Smooth animations (60fps)
- No jank or stuttering
- CPU usage < 50%

---

## Browser Compatibility

Test in the following browsers:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)

Verify:
- Layout renders correctly
- Colors display correctly
- Animations work smoothly
- No console errors

---

## Mobile Responsiveness

Test on mobile devices:
- ✅ iPhone (Safari)
- ✅ Android (Chrome)

Verify:
- Cards stack vertically
- Touch interactions work
- Text is readable
- Buttons are tappable

---

## Accessibility Testing

### Keyboard Navigation
1. Tab through all interactive elements
2. Verify focus indicators visible
3. Verify all buttons accessible via keyboard
4. Verify Enter/Space activate buttons

### Screen Reader
1. Test with screen reader (NVDA/JAWS)
2. Verify all content announced
3. Verify button labels clear
4. Verify status changes announced

---

## Regression Testing

Verify existing features still work:
- ✅ Application list page
- ✅ Discovery functionality
- ✅ Server management
- ✅ Diagnostics tab
- ✅ Configuration tab
- ✅ Healing actions

---

## Known Issues

### Issue 1: Subdomain Configuration Not Implemented
- **Status**: Placeholder only
- **Workaround**: Shows "Coming Soon" toast
- **Fix**: Implement in next phase

### Issue 2: Subdomain Diagnostics Not Filtered
- **Status**: Returns all diagnostics
- **Workaround**: None needed yet
- **Fix**: Add subdomain field to diagnostic_results table

### Issue 3: Health Scores Not Calculated Per Subdomain
- **Status**: Using placeholder values
- **Workaround**: Run diagnosis to update
- **Fix**: Implement per-subdomain calculation

---

## Bug Reporting

If you find a bug, report with:
1. **Title**: Brief description
2. **Steps to Reproduce**: Detailed steps
3. **Expected Result**: What should happen
4. **Actual Result**: What actually happened
5. **Screenshots**: If applicable
6. **Browser/OS**: Environment details
7. **Console Errors**: Any error messages

---

## Success Criteria

The feature is considered successful if:
- ✅ All domains display correctly
- ✅ Expand/collapse works smoothly
- ✅ Diagnosis works for main and subdomains
- ✅ Healer toggle works for main and subdomains
- ✅ No console errors
- ✅ No layout issues
- ✅ Performance is acceptable
- ✅ All API endpoints work
- ✅ Data persists correctly

---

**Last Updated**: February 26, 2026
**Version**: 1.0
**Status**: Ready for Testing
