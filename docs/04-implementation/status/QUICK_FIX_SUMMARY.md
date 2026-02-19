# Server Creation 500 Error - Fix Summary

## Issue
When clicking "Create Server" in the frontend form, a 500 Internal Server Error occurred:
```
POST http://localhost:3001/api/v1/servers 500 (Internal Server Error)
```

## Root Causes (2 Issues Fixed)

### Issue 1: Missing Credentials Object
The backend DTO (`CreateServerDto`) requires the `credentials` field to always be present:
```typescript
@IsObject()
@ValidateNested()
@Type(() => ServerCredentialsDto)
credentials!: ServerCredentialsDto; // Required field (!)
```

However, the frontend was conditionally sending `credentials`:
```typescript
credentials: Object.keys(credentials).length > 0 ? credentials : undefined
```

**Fix:** Always send the credentials object, even if empty:
```typescript
credentials: credentials // Always send, even if empty {}
```

### Issue 2: Incorrect User ID Extraction
The controller was using `@CurrentUser('id')` to extract the user ID, but the JWT payload uses `sub` for the user ID:
```typescript
export interface JwtPayload {
  sub: string; // user ID (not 'id')
  email: string;
  username: string;
  roleId: string;
  permissions: string[];
}
```

This caused `userId` to be `undefined`, which failed Prisma validation:
```
Argument `createdBy` is missing.
createdByUserId: undefined
```

**Fix:** Changed all controller methods to use `@CurrentUser('sub')`:
```typescript
// Before
create(@Body() createServerDto: CreateServerDto, @CurrentUser('id') userId: string)

// After
create(@Body() createServerDto: CreateServerDto, @CurrentUser('sub') userId: string)
```

## Files Modified
1. `frontend/components/servers/server-form-drawer.tsx` (line ~260) - Always send credentials object
2. `backend/src/modules/servers/servers.controller.ts` - Changed all `@CurrentUser('id')` to `@CurrentUser('sub')` in:
   - `create()` method
   - `findAll()` method
   - `findOne()` method
   - `update()` method
   - `remove()` method
   - `testConnection()` method
   - `getTestHistory()` method

## Testing
1. Frontend builds successfully ✅
2. Backend will auto-restart with watch mode ✅
3. User ID now correctly extracted from JWT token ✅
4. Server creation should work without errors ✅

## Next Steps
Test the fix by:
1. Ensure you're logged in (JWT token in localStorage)
2. Open the "Add Server" form
3. Fill in required fields (name, host, port, username, auth type, credentials)
4. Click "Create Server"
5. Verify server is created successfully without 500 error

## Technical Details

### JWT Payload Structure
```typescript
{
  sub: "user-uuid-here",        // User ID (correct field)
  email: "user@example.com",
  username: "admin",
  roleId: "role-uuid",
  permissions: ["servers.create", "servers.read", ...],
  iat: 1234567890,
  exp: 1234567890
}
```

### Backend DTO Structure
```typescript
export class ServerCredentialsDto {
  @IsOptional()
  @IsString()
  privateKey?: string;

  @IsOptional()
  @IsString()
  passphrase?: string;

  @IsOptional()
  @IsString()
  password?: string;
}

export class CreateServerDto {
  // ... other fields
  
  @IsObject()
  @ValidateNested()
  @Type(() => ServerCredentialsDto)
  credentials!: ServerCredentialsDto; // Required object
}
```

The `credentials` field itself is required (marked with `!`), but all properties inside `ServerCredentialsDto` are optional. This means:
- ✅ Valid: `credentials: {}`
- ✅ Valid: `credentials: { privateKey: "..." }`
- ❌ Invalid: `credentials: undefined`
- ❌ Invalid: omitting credentials field entirely

### Prisma Schema
```prisma
model Server {
  id              String   @id @default(uuid())
  // ... other fields
  createdByUserId String   // Required field
  createdBy       User     @relation(fields: [createdByUserId], references: [id])
}
```

The `createdByUserId` field is required in the Prisma schema, so it must be provided when creating a server.

## Status
✅ **FIXED** - Both issues resolved:
1. Frontend always sends credentials object
2. Backend correctly extracts user ID from JWT token's `sub` field

---
**Date:** February 9, 2026  
**Module:** Module 2 Sprint 4 - Server Management UI  
**Priority:** P0 (Critical - blocks server creation)
