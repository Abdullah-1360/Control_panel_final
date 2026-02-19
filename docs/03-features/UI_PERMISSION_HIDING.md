# UI Permission-Based Hiding Implementation

**Date:** February 8, 2026  
**Feature:** Hide UI elements instead of showing "Insufficient permissions" errors

---

## Overview

Instead of showing "403 Forbidden" or "Insufficient permissions" errors, the UI now hides buttons, tabs, and actions that users don't have permission to access. This provides a cleaner, more intuitive user experience.

---

## Changes Made

### 1. ✅ Fixed VIEWER Permissions

**Problem:** VIEWER had wildcard `*.read` permission, giving access to everything in read mode.

**Solution:** Replaced wildcard with specific read-only permissions:

**VIEWER permissions (NEW):**
- `users.read` - View users list
- `roles.read` - View roles
- `sessions.read` - View own sessions
- `audit.read` - View audit logs
- `servers.read` - View servers (Module 2)
- `sites.read` - View sites (Module 3)
- `incidents.read` - View incidents (Module 6)
- `settings.read` - View settings (read-only)

**Script:** `backend/scripts/fix-viewer-permissions.ts`

**To apply:**
```bash
cd backend
npx ts-node scripts/fix-viewer-permissions.ts
```

---

### 2. ✅ Created Permission Checking Utilities

**File:** `frontend/lib/auth/permissions.ts`

**Utilities provided:**
- `usePermission(resource, action)` - Check single permission
- `usePermissions([...])` - Check multiple permissions (ALL required)
- `useAnyPermission([...])` - Check if user has ANY permission
- `useRole(roleName)` - Check if user has specific role
- `useAnyRole([...])` - Check if user has any of the roles

**Example usage:**
```typescript
import { usePermission } from '@/lib/auth/permissions';

function MyComponent() {
  const canCreate = usePermission('users', 'create');
  const canUpdate = usePermission('users', 'update');
  const canDelete = usePermission('users', 'delete');
  
  return (
    <>
      {canCreate && <Button>Create User</Button>}
      {canUpdate && <Button>Edit User</Button>}
      {canDelete && <Button>Delete User</Button>}
    </>
  );
}
```

---

### 3. ✅ Updated Users View with Permission Checks

**File:** `frontend/components/dashboard/users-view.tsx`

**Changes:**
1. **Create User button** - Only visible if user has `users.create` permission
2. **Actions dropdown** - Only visible if user has `users.update` or `users.delete`
3. **Edit/Change Role/Activate/Deactivate/Unlock** - Only visible if user has `users.update`
4. **Delete** - Only visible if user has `users.delete`

**Before:**
```typescript
// Everyone saw the button, got error on click
<Button onClick={() => setShowCreateDialog(true)}>
  Create User
</Button>
```

**After:**
```typescript
// Button only visible if user has permission
{canCreate && (
  <Button onClick={() => setShowCreateDialog(true)}>
    Create User
  </Button>
)}
```

---

## Permission Matrix by Role

### SUPER_ADMIN
- **Can see:** Everything
- **Can do:** Everything
- **UI:** All buttons, tabs, and actions visible

### ADMIN
- **Can see:** Users, Roles, Sessions, Servers, Sites, Incidents, Settings, Audit
- **Can do:** Create/Update/Delete users, Manage servers/sites/incidents, Update settings
- **UI:** Create User button visible, all actions visible except SMTP tab

### ENGINEER
- **Can see:** Incidents, Sites, Servers, Audit, Roles, Sessions
- **Can do:** Manage incidents, View servers/sites
- **UI:** No Create User button, no user actions dropdown, read-only access

### VIEWER
- **Can see:** Users, Roles, Sessions, Audit, Servers, Sites, Incidents, Settings (all read-only)
- **Can do:** View only, no modifications
- **UI:** No Create User button, no actions dropdown, all pages read-only

---

## Implementation Pattern

### Step 1: Add Permission Check Hook
```typescript
import { usePermission } from '@/lib/auth/permissions';

const canCreate = usePermission('resource', 'create');
const canUpdate = usePermission('resource', 'update');
const canDelete = usePermission('resource', 'delete');
```

### Step 2: Conditionally Render UI Elements
```typescript
{canCreate && (
  <Button onClick={handleCreate}>
    Create
  </Button>
)}

{canUpdate && (
  <Button onClick={handleUpdate}>
    Edit
  </Button>
)}

{canDelete && (
  <Button onClick={handleDelete}>
    Delete
  </Button>
)}
```

### Step 3: Hide Entire Sections if No Permissions
```typescript
{(canUpdate || canDelete) && (
  <DropdownMenu>
    {/* Actions */}
  </DropdownMenu>
)}
```

---

## Testing Checklist

### Test as SUPER_ADMIN
```bash
# Login as admin@opsmanager.local
# Go to Users page
✅ Create User button visible
✅ Actions dropdown visible for all users
✅ All actions (Edit, Change Role, Activate, Deactivate, Delete) visible
```

### Test as ADMIN
```bash
# Login as admin@test.com
# Go to Users page
✅ Create User button visible
✅ Actions dropdown visible for all users
✅ All actions visible
❌ SMTP tab in settings NOT visible (correct)
```

### Test as ENGINEER
```bash
# Login as engineer@test.com
# Go to Users page
✅ Can see users list
❌ Create User button NOT visible (correct)
❌ Actions dropdown NOT visible (correct)
✅ Can view but not modify
```

### Test as VIEWER
```bash
# Login as viewer@test.com
# Go to Users page
✅ Can see users list
❌ Create User button NOT visible (correct)
❌ Actions dropdown NOT visible (correct)
✅ All pages read-only
❌ Cannot create, update, or delete anything (correct)
```

---

## Future Enhancements

### 1. Hide Navigation Items
Hide entire pages from navigation if user has no read permission:

```typescript
// In navigation component
{usePermission('users', 'read') && (
  <NavItem href="/users">Users</NavItem>
)}
```

### 2. Hide Tabs
Hide tabs in settings page based on permissions:

```typescript
{usePermission('settings', 'update') && (
  <TabsTrigger value="smtp">SMTP</TabsTrigger>
)}
```

### 3. Disable Instead of Hide
For some actions, disable instead of hide:

```typescript
<Button 
  disabled={!canUpdate}
  onClick={handleUpdate}
>
  Edit
</Button>
```

---

## Files Modified/Created

### Backend
- ✅ `backend/scripts/fix-viewer-permissions.ts` (NEW) - Fix VIEWER permissions
- ✅ Database: Updated VIEWER role permissions

### Frontend
- ✅ `frontend/lib/auth/permissions.ts` (NEW) - Permission checking utilities
- ✅ `frontend/components/dashboard/users-view.tsx` (MODIFIED) - Added permission checks

---

## Important Notes

### Permission Changes Require Re-Login
- JWT tokens are immutable
- Permission changes only apply to new tokens
- Users must log out and log back in

### Backend Still Validates
- Hiding UI elements is NOT security
- Backend still validates all permissions
- This is UX improvement only

### Consistent Behavior
- All components should use the same pattern
- Always check permissions before showing actions
- Never show actions that will fail

---

## Status: ✅ IMPLEMENTED

UI now hides elements based on permissions instead of showing error messages. VIEWER permissions restricted to read-only access.

**Next:** Apply this pattern to other components (Sessions, Audit, Settings, etc.)
