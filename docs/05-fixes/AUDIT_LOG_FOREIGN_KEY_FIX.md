# Audit Log Foreign Key Constraint Fix

## Date: February 16, 2026

## Issue

**Error:**
```
Foreign key constraint violated: `audit_logs_userId_fkey (index)`
Invalid `this.prisma.auditLog.create()` invocation
```

**Context:**
- Occurred when metrics collection exceeded thresholds
- Metrics service tried to create audit log with `userId: 'SYSTEM'`
- Database rejected because no user with ID 'SYSTEM' exists

## Root Cause

The metrics service was passing `userId: 'SYSTEM'` when creating audit logs for system-generated events:

```typescript
await this.audit.log({
  userId: 'SYSTEM',  // ❌ No user with this ID exists
  actorType: 'SYSTEM',
  action: 'METRICS_THRESHOLD_EXCEEDED',
  // ...
});
```

The `audit_logs` table has a foreign key constraint:
```prisma
model AuditLog {
  userId    String?
  user      User?   @relation(fields: [userId], references: [id], onDelete: SetNull)
  // ...
}
```

When `userId` is provided, it must reference an existing user. The string 'SYSTEM' is not a valid user ID.

## Solution

Changed `userId` to `undefined` for SYSTEM actor events:

```typescript
await this.audit.log({
  userId: undefined,  // ✅ No userId for system events
  actorType: 'SYSTEM',
  action: 'METRICS_THRESHOLD_EXCEEDED',
  // ...
});
```

This correctly indicates that the event was triggered by the system, not by a specific user.

## Actor Types Explained

### USER Actor
- Represents actions performed by a logged-in user
- **Must** have `userId` set to the user's ID
- Example: User creates a server, updates settings, etc.

```typescript
await this.audit.log({
  userId: user.id,        // ✅ Valid user ID
  actorType: 'USER',
  action: 'SERVER_CREATED',
  // ...
});
```

### SYSTEM Actor
- Represents automated system actions
- **Should NOT** have `userId` (set to undefined/null)
- Example: Metrics threshold exceeded, scheduled tasks, automatic locks

```typescript
await this.audit.log({
  userId: undefined,      // ✅ No user for system events
  actorType: 'SYSTEM',
  action: 'METRICS_THRESHOLD_EXCEEDED',
  // ...
});
```

### SYSTEM Actor with User Context
- System action related to a specific user
- **Has** `userId` to show which user is affected
- Example: Account locked due to failed attempts

```typescript
await this.audit.log({
  userId: user.id,        // ✅ User affected by system action
  actorType: 'SYSTEM',
  action: 'ACCOUNT_LOCKED',
  // ...
});
```

## Files Changed

### `backend/src/modules/servers/server-metrics.service.ts`
```typescript
// Before
await this.audit.log({
  userId: 'SYSTEM',  // ❌ Invalid
  actorType: 'SYSTEM',
  // ...
});

// After
await this.audit.log({
  userId: undefined,  // ✅ Correct
  actorType: 'SYSTEM',
  // ...
});
```

## Testing

### Before Fix
```bash
[Nest] ERROR [PrismaService] Prisma error:
Foreign key constraint violated: `audit_logs_userId_fkey (index)`

[Nest] ERROR [AuditService] Failed to create audit log:
PrismaClientKnownRequestError: Foreign key constraint violated
```

### After Fix
```bash
[Nest] WARN [ServerMetricsService] Server cp4 exceeded thresholds: CPU usage (100%) exceeded threshold (85%)
[Nest] LOG [ServerMetricsService] Metrics collected for server cp4 in 7380ms

✅ Audit log created successfully
✅ No foreign key constraint errors
✅ Metrics collection completes normally
```

## Impact

### ✅ Fixed
- Metrics collection no longer crashes when thresholds exceeded
- Audit logs correctly record system events
- Foreign key constraints respected

### ✅ Improved
- Clearer distinction between user and system actions
- Proper null handling for system events
- Better data integrity

## Related Code Patterns

### Correct Patterns

**1. User Action**
```typescript
await this.audit.log({
  userId: req.user.id,
  actorType: 'USER',
  action: 'RESOURCE_CREATED',
  // ...
});
```

**2. System Action (No User)**
```typescript
await this.audit.log({
  userId: undefined,
  actorType: 'SYSTEM',
  action: 'SCHEDULED_TASK_COMPLETED',
  // ...
});
```

**3. System Action (Affecting User)**
```typescript
await this.audit.log({
  userId: user.id,
  actorType: 'SYSTEM',
  action: 'PASSWORD_RESET_EXPIRED',
  // ...
});
```

**4. API Action**
```typescript
await this.audit.log({
  userId: undefined,
  actorType: 'API',
  actorId: apiKey.id,
  action: 'API_REQUEST',
  // ...
});
```

### Incorrect Patterns

**❌ Don't use string literals for userId**
```typescript
await this.audit.log({
  userId: 'SYSTEM',     // ❌ Not a valid user ID
  userId: 'ANONYMOUS',  // ❌ Not a valid user ID
  userId: 'ADMIN',      // ❌ Not a valid user ID
  // ...
});
```

**❌ Don't use null explicitly (use undefined)**
```typescript
await this.audit.log({
  userId: null,  // ❌ Use undefined instead
  // ...
});
```

## Recommendations

### 1. Code Review Checklist
When creating audit logs, verify:
- [ ] Is this a user action? → Use `userId: user.id`
- [ ] Is this a system action? → Use `userId: undefined`
- [ ] Is this a system action affecting a user? → Use `userId: user.id` with `actorType: 'SYSTEM'`

### 2. Add Type Safety
Consider creating helper functions:

```typescript
// Helper for user actions
async logUserAction(userId: string, action: string, details: Partial<CreateAuditLogDto>) {
  await this.audit.log({
    userId,
    actorType: 'USER',
    action,
    ...details,
  });
}

// Helper for system actions
async logSystemAction(action: string, details: Partial<CreateAuditLogDto>) {
  await this.audit.log({
    userId: undefined,
    actorType: 'SYSTEM',
    action,
    ...details,
  });
}
```

### 3. Database Validation
The current schema is correct:
```prisma
userId    String?  // Optional - allows null/undefined
user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
```

This allows:
- ✅ Valid user IDs
- ✅ Null/undefined for system events
- ❌ Invalid user IDs (foreign key constraint)

## Conclusion

The audit log foreign key constraint error has been fixed by correctly using `undefined` for system-generated events instead of the string 'SYSTEM'. This maintains data integrity while properly recording system actions.

**Status:** ✅ FIXED
**Impact:** ✅ CRITICAL BUG RESOLVED
**Data Integrity:** ✅ MAINTAINED
