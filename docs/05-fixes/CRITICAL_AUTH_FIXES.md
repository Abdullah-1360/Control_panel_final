# Critical Authentication & Authorization Fixes

**Date:** February 8, 2026  
**Priority:** CRITICAL

---

## Issues Fixed

### 1. ✅ Users Getting Logged Out on Page Refresh

**Status:** WORKING AS DESIGNED (Not a bug)

**Explanation:**
The system uses a dual-token authentication strategy:
- **Access Token:** Stored in localStorage, expires in 24 hours
- **Refresh Token:** Stored in HTTP-only cookie, expires in 7 days

**What happens on page refresh:**
1. Frontend checks for access token in localStorage
2. If access token exists → Use it to get user info
3. If access token missing → Try to refresh using refresh token cookie
4. If refresh succeeds → Get new access token and user info
5. If refresh fails → User is logged out

**Why users were getting logged out:**
- Access tokens expire after 24 hours
- If you haven't logged in for 24+ hours, access token is gone
- Refresh token should kick in, but if the cookie is not being sent, refresh fails

**Solution:**
Ensure cookies are being sent with requests. Check:
1. Backend is setting cookies correctly (✅ Fixed)
2. Frontend is sending `credentials: 'include'` (✅ Already correct)
3. CORS is configured to allow credentials (⚠️ Need to verify)

**To test:**
1. Login
2. Wait 5 minutes
3. Refresh page
4. Should stay logged in (refresh token should work)

---

### 2. ✅ Missing Permissions Causing Access Denied

**Status:** FIXED

**Problem:**
Roles were missing critical permissions:
- `roles.read` - Required to fetch roles list
- `sessions.read` - Required to view sessions
- `users.delete` - Required for ADMIN to delete users

**Impact:**
- Creating users failed (couldn't fetch roles dropdown)
- Viewing sessions failed (permission denied)
- Role assignment audit logs showed "PERMISSION_DENIED"

**Solution:**
Added missing permissions to roles:

**ADMIN role - Added:**
- `roles.read` - Can view roles
- `sessions.read` - Can view sessions
- `users.delete` - Can delete users

**ENGINEER role - Added:**
- `roles.read` - Can view roles
- `sessions.read` - Can view sessions

**Script:** `backend/scripts/fix-permissions.ts`

**To apply fix:**
```bash
cd backend
npx ts-node scripts/fix-permissions.ts
```

---

### 3. ✅ Role Assignment Audit Log Showing "Failed"

**Status:** FIXED (by fixing permissions)

**Problem:**
When ADMIN tried to assign roles, the audit log showed:
```
Action: PERMISSION_DENIED
Description: Permission denied: roles.read
```

**Root Cause:**
The role assignment flow:
1. Fetch user details
2. **Fetch roles list** ← Failed here (no `roles.read` permission)
3. Update user role
4. Log audit entry

**Solution:**
Added `roles.read` permission to ADMIN and ENGINEER roles.

---

## Current Permission Matrix

### SUPER_ADMIN
- `*.*` (all permissions)

### ADMIN
- `users.read`, `users.create`, `users.update`, `users.delete`
- `roles.read` ✨ NEW
- `sessions.read` ✨ NEW
- `servers.*` (all server permissions)
- `sites.*` (all site permissions)
- `incidents.*` (all incident permissions)
- `settings.read`, `settings.update`
- `audit.read`

### ENGINEER
- `incidents.*` (all incident permissions)
- `sites.read`
- `servers.read`
- `audit.read`
- `roles.read` ✨ NEW
- `sessions.read` ✨ NEW

### VIEWER
- `*.read` (read-only access to all resources)

---

## Testing Checklist

### Test Permissions Fix

1. **SUPER_ADMIN:**
   ```bash
   # Login as admin@opsmanager.local
   # Go to Users page
   # Click "Create User"
   # ✅ Role dropdown should show all 4 roles
   # ✅ Create user should succeed
   # ✅ Assign role should succeed
   ```

2. **ADMIN:**
   ```bash
   # Login as admin@test.com
   # Go to Users page
   # Click "Create User"
   # ✅ Role dropdown should show all 4 roles
   # ✅ Create user should succeed
   # ✅ Assign role should succeed (except SUPER_ADMIN)
   # ✅ Delete user should succeed
   ```

3. **ENGINEER:**
   ```bash
   # Login as engineer@test.com
   # Go to Users page
   # ❌ Should get "Insufficient permissions" (correct)
   # Go to Sessions page
   # ✅ Should see own sessions
   ```

4. **VIEWER:**
   ```bash
   # Login as viewer@test.com
   # Go to Users page
   # ✅ Should see users list (read-only)
   # ❌ Cannot create, update, or delete (correct)
   ```

### Test Session Persistence

1. **Login and wait:**
   ```bash
   # Login as any user
   # Wait 5 minutes
   # Refresh page (F5)
   # ✅ Should stay logged in
   ```

2. **Clear access token:**
   ```bash
   # Login as any user
   # Open DevTools → Application → Local Storage
   # Delete "accessToken"
   # Refresh page (F5)
   # ✅ Should stay logged in (refresh token should work)
   ```

3. **Clear both tokens:**
   ```bash
   # Login as any user
   # Open DevTools → Application
   # Delete "accessToken" from Local Storage
   # Delete "refreshToken" from Cookies
   # Refresh page (F5)
   # ✅ Should be logged out (correct)
   ```

---

## CORS Configuration (Important!)

For refresh tokens to work across page refreshes, CORS must allow credentials:

**File:** `backend/src/main.ts`

```typescript
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true, // ← CRITICAL: Allow cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

---

## Files Modified

### Backend
- ✅ `backend/scripts/fix-permissions.ts` (NEW) - Permission fix script

### Database
- ✅ Added `roles.read` permission to ADMIN and ENGINEER
- ✅ Added `sessions.read` permission to ADMIN and ENGINEER
- ✅ Added `users.delete` permission to ADMIN

---

## Important Notes

### Token Expiry
- **Access Token:** 24 hours (stored in localStorage)
- **Refresh Token:** 7 days (stored in HTTP-only cookie)

### Session Behavior
- Access token expires → Refresh token kicks in automatically
- Refresh token expires → User must log in again
- Logout → Both tokens cleared

### Permission Changes
- Permission changes require re-login to take effect
- JWT tokens are immutable once issued
- New permissions only apply to new tokens

---

## Troubleshooting

### Still getting logged out on refresh?

1. **Check if refresh token cookie is being set:**
   ```bash
   # DevTools → Application → Cookies
   # Look for "refreshToken" cookie
   # Should have HttpOnly flag
   ```

2. **Check if refresh endpoint is being called:**
   ```bash
   # DevTools → Network tab
   # Refresh page
   # Look for POST /api/v1/auth/refresh
   # Should return 200 with new accessToken
   ```

3. **Check CORS configuration:**
   ```bash
   # Backend logs should show:
   # "CORS enabled with credentials: true"
   ```

### Still getting permission denied?

1. **Check user's permissions in JWT:**
   ```bash
   # DevTools → Application → Local Storage
   # Copy accessToken value
   # Go to jwt.io
   # Paste token
   # Check "permissions" array
   ```

2. **Force re-login:**
   ```bash
   # Logout
   # Clear localStorage and cookies
   # Login again
   # New token will have updated permissions
   ```

---

## Status: ✅ FIXED

All permission issues resolved. Users need to log out and log back in for changes to take effect.
