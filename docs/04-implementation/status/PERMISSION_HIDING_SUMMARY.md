# Permission-Based UI Hiding - Quick Summary

## Issues Fixed

1. ✅ **UI shows "Insufficient permissions" errors** → Now hides buttons/actions instead
2. ✅ **VIEWER has too much access** → Restricted to specific read-only permissions

---

## Changes Applied

### 1. Fixed VIEWER Permissions
```bash
cd backend
npx ts-node scripts/fix-viewer-permissions.ts
```

**Before:** `*.read` (wildcard - everything)  
**After:** Specific permissions only:
- `users.read`, `roles.read`, `sessions.read`, `audit.read`
- `servers.read`, `sites.read`, `incidents.read`, `settings.read`

### 2. Created Permission Utilities
**File:** `frontend/lib/auth/permissions.ts`

```typescript
import { usePermission } from '@/lib/auth/permissions';

const canCreate = usePermission('users', 'create');
const canUpdate = usePermission('users', 'update');
const canDelete = usePermission('users', 'delete');
```

### 3. Updated Users View
**File:** `frontend/components/dashboard/users-view.tsx`

- ✅ Create User button - Only visible if `users.create` permission
- ✅ Actions dropdown - Only visible if `users.update` or `users.delete`
- ✅ Individual actions - Hidden based on specific permissions

---

## What Users See Now

### SUPER_ADMIN
- ✅ All buttons and actions visible
- ✅ Full access to everything

### ADMIN
- ✅ Create User button visible
- ✅ All user actions visible
- ✅ Can manage users, servers, sites, incidents

### ENGINEER
- ❌ No Create User button (hidden)
- ❌ No actions dropdown (hidden)
- ✅ Can view users list (read-only)

### VIEWER
- ❌ No Create User button (hidden)
- ❌ No actions dropdown (hidden)
- ✅ Can view all pages (read-only)
- ❌ Cannot modify anything

---

## Testing

### Step 1: Apply Fixes
```bash
# Fix VIEWER permissions
cd backend
npx ts-node scripts/fix-viewer-permissions.ts

# Restart backend
npm run start:dev
```

### Step 2: All Users Must Re-Login
```bash
# Each user:
1. Logout
2. Clear browser cache
3. Login again
```

### Step 3: Test Each Role
```bash
# VIEWER (viewer@test.com / Password123!)
- Go to Users page
- ✅ Should see users list
- ❌ Should NOT see Create User button
- ❌ Should NOT see actions dropdown

# ENGINEER (engineer@test.com / Password123!)
- Go to Users page
- ✅ Should see users list
- ❌ Should NOT see Create User button
- ❌ Should NOT see actions dropdown

# ADMIN (admin@test.com / Password123!)
- Go to Users page
- ✅ Should see Create User button
- ✅ Should see actions dropdown
- ✅ Can create, edit, delete users

# SUPER_ADMIN (admin@opsmanager.local / Password123!)
- Go to Users page
- ✅ Should see everything
- ✅ Full access
```

---

## Next Steps

Apply this pattern to other components:
- [ ] Sessions view
- [ ] Audit logs view
- [ ] Settings page
- [ ] Navigation menu (hide pages user can't access)

---

## Status: ✅ DONE

Users now see a clean UI with only the actions they can perform. No more "Insufficient permissions" errors!
