# Logout on Page Refresh - Root Cause Analysis & Fix

## Problem Description

Users were getting logged out when refreshing the page. The dashboard would show for 2 seconds, then redirect to login.

## Console Logs Analysis

```
client.ts:66 Fetch finished loading: GET "http://localhost:3001/api/v1/auth/me"
client.ts:66 Fetch finished loading: GET "http://localhost:3001/api/v1/auth/me"
protected-route.tsx:22 Fetch finished loading: GET "http://localhost:3000/login?_rsc=vusbg"
```

**Key Observations:**
1. `/auth/me` endpoint called **twice** on page load
2. Dashboard renders briefly before redirect
3. Multiple auth checks happening simultaneously

## Root Causes

### 1. Zustand Persist Middleware Issue

**Problem:** The persist middleware was storing `isAuthenticated: true` in localStorage. On page refresh:
1. Zustand hydrates state from localStorage → `isAuthenticated: true`
2. ProtectedRoute sees `isAuthenticated: true` → renders dashboard
3. `checkAuth()` runs asynchronously → fails → sets `isAuthenticated: false`
4. ProtectedRoute sees `isAuthenticated: false` → redirects to login

**Result:** Dashboard flashes for 2 seconds before redirect.

### 2. Multiple Simultaneous Auth Checks

**Problem:** The `checkAuth()` guard was checking `get().isLoading`, but this wasn't preventing multiple calls because:
- First call sets `isLoading: true`
- Second call checks `isLoading` before first call updates state
- Both calls proceed simultaneously

**Result:** `/auth/me` called twice, race conditions, inconsistent state.

### 3. Persisted State Treated as Valid

**Problem:** Persisted `isAuthenticated` state was trusted without verification. If the access token expired or was invalid, the user would still appear authenticated until `checkAuth()` completed.

**Result:** False positive authentication state.

## Solutions Implemented

### Fix 1: Don't Persist `isAuthenticated`

**Change:** Modified Zustand persist config to:
- Only persist `user` data (for display purposes)
- **Never persist** `isAuthenticated` flag
- Force `isAuthenticated: false` on rehydration

**Code:**
```typescript
{
  name: 'auth-storage',
  partialize: (state) => ({
    // Only persist user data, NOT isAuthenticated
    user: state.user,
  }),
  // Force isAuthenticated to false on rehydration
  onRehydrateStorage: () => (state) => {
    if (state) {
      state.isAuthenticated = false;
    }
  },
}
```

**Result:** Every page load requires auth verification, no false positives.

### Fix 2: Module-Level Guard for `checkAuth()`

**Change:** Added module-level `isCheckingAuth` flag to prevent multiple simultaneous calls.

**Code:**
```typescript
let isCheckingAuth = false;

checkAuth: async () => {
  // Prevent multiple simultaneous calls
  if (isCheckingAuth) {
    console.log('[Auth] Already checking auth, skipping...');
    return;
  }

  isCheckingAuth = true;
  try {
    // ... auth check logic
  } finally {
    isCheckingAuth = false;
  }
}
```

**Result:** Only one auth check runs at a time, no race conditions.

### Fix 3: Improved ProtectedRoute Loading State

**Change:** Simplified ProtectedRoute to use single `isChecking` state.

**Code:**
```typescript
const [isChecking, setIsChecking] = useState(true)

useEffect(() => {
  const verifyAuth = async () => {
    await checkAuth()
    setIsChecking(false)
  }
  verifyAuth()
}, [checkAuth])

// Show loading while checking
if (isChecking || isLoading) {
  return <LoadingSpinner message="Verifying authentication..." />
}

// Don't render children until authenticated
if (!isAuthenticated) {
  return null
}
```

**Result:** No dashboard flash, clean loading → authenticated → render flow.

## Authentication Flow (After Fix)

### Page Load Sequence

1. **Zustand Rehydration**
   - Loads `user` from localStorage (for display)
   - Sets `isAuthenticated: false` (forced)

2. **ProtectedRoute Mount**
   - Sets `isChecking: true`
   - Shows loading spinner
   - Calls `checkAuth()`

3. **checkAuth() Execution**
   - Checks if already running (module-level guard)
   - If access token exists:
     - Calls `/auth/me` to verify token
     - If valid: Sets `isAuthenticated: true`, updates user
     - If invalid: Clears token, sets `isAuthenticated: false`
   - If no access token:
     - Attempts refresh token flow
     - If refresh succeeds: Gets new access token, sets `isAuthenticated: true`
     - If refresh fails: Sets `isAuthenticated: false`

4. **ProtectedRoute Response**
   - If `isAuthenticated: true`: Renders dashboard
   - If `isAuthenticated: false`: Redirects to login
   - No flash, no race conditions

## Token Refresh Flow

### When Access Token Missing

1. Check localStorage for `accessToken`
2. If missing, attempt refresh:
   ```typescript
   POST /auth/refresh
   Credentials: include (sends HTTP-only refresh token cookie)
   ```
3. If refresh succeeds:
   - Store new `accessToken` in localStorage
   - Call `/auth/me` to get user data
   - Set `isAuthenticated: true`
4. If refresh fails:
   - Set `isAuthenticated: false`
   - Redirect to login

### When Access Token Expired (401 Response)

1. API client intercepts 401 response
2. Attempts token refresh (same flow as above)
3. If refresh succeeds:
   - Retry original request with new token
4. If refresh fails:
   - Clear tokens
   - Throw error (triggers logout)

## Testing Checklist

### ✅ Verified Scenarios

1. **Fresh Login**
   - ✅ User logs in → Dashboard loads
   - ✅ Access token stored in localStorage
   - ✅ Refresh token stored in HTTP-only cookie

2. **Page Refresh (Valid Token)**
   - ✅ Page refreshes → Loading spinner shows
   - ✅ `/auth/me` called once (not twice)
   - ✅ Dashboard loads without flash
   - ✅ User stays logged in

3. **Page Refresh (Expired Access Token, Valid Refresh Token)**
   - ✅ Page refreshes → Loading spinner shows
   - ✅ Token refresh attempted
   - ✅ New access token obtained
   - ✅ Dashboard loads
   - ✅ User stays logged in

4. **Page Refresh (Both Tokens Expired)**
   - ✅ Page refreshes → Loading spinner shows
   - ✅ Token refresh fails
   - ✅ Redirects to login
   - ✅ No dashboard flash

5. **Manual Logout**
   - ✅ User clicks logout
   - ✅ Tokens cleared
   - ✅ Redirects to login

6. **Multiple Tabs**
   - ✅ Open multiple tabs
   - ✅ Each tab verifies auth independently
   - ✅ No race conditions

## Key Takeaways

### What Went Wrong

1. **Trusting Persisted State:** Never trust persisted authentication state without verification
2. **Weak Guards:** Component-level state isn't sufficient for preventing race conditions
3. **Premature Rendering:** Rendering protected content before auth verification completes

### Best Practices Applied

1. **Always Verify:** Every page load must verify authentication with backend
2. **Strong Guards:** Use module-level flags for critical operations
3. **Loading States:** Show loading until verification completes
4. **Token Strategy:**
   - Access token: Short-lived (24h), stored in localStorage
   - Refresh token: Long-lived (7d), HTTP-only cookie
   - Automatic refresh on 401 responses

### Performance Considerations

- **Single Auth Check:** Module-level guard prevents duplicate API calls
- **Persisted User Data:** Display user info immediately (from localStorage) while verifying
- **Optimistic UI:** Show loading spinner instead of blank page

## Files Modified

1. `frontend/lib/auth/store.ts`
   - Added module-level `isCheckingAuth` guard
   - Modified persist config to exclude `isAuthenticated`
   - Added `onRehydrateStorage` to force `isAuthenticated: false`

2. `frontend/lib/auth/protected-route.tsx`
   - Simplified to single `isChecking` state
   - Improved loading message
   - Cleaner auth verification flow

## Monitoring & Debugging

### Console Logs to Watch

```typescript
// Good: Single auth check
[Auth] Already checking auth, skipping...

// Bad: Multiple auth checks
Fetch finished loading: GET "/auth/me"
Fetch finished loading: GET "/auth/me"
```

### State to Monitor

```typescript
// Zustand DevTools
{
  user: { ... },           // Persisted
  isAuthenticated: false,  // NOT persisted, always false on load
  isLoading: false
}
```

### Network Tab

- **Expected:** Single `/auth/me` call on page load
- **Unexpected:** Multiple `/auth/me` calls (indicates race condition)

## Future Improvements

1. **WebSocket for Real-Time Auth Events**
   - Notify all tabs when user logs out
   - Sync auth state across tabs

2. **Token Expiry Tracking**
   - Store token expiry time
   - Proactively refresh before expiry

3. **Offline Support**
   - Cache user data for offline viewing
   - Queue actions when offline

4. **Session Monitoring**
   - Detect concurrent sessions
   - Allow user to revoke other sessions

---

**Status:** ✅ FIXED
**Date:** February 8, 2026
**Tested By:** All user roles (SUPER_ADMIN, ADMIN, ENGINEER, VIEWER)
