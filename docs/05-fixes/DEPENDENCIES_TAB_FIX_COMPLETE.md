# Dependencies Tab Fix - Complete

## Issue
The dependencies tab in the server detail page was not updating to show integrations linked to the server.

## Root Cause
The `checkDependencies()` method in `backend/src/modules/servers/servers.service.ts` was returning hardcoded empty dependencies instead of querying the database for actual relationships.

## Changes Made

### 1. Backend Service Update
**File:** `backend/src/modules/servers/servers.service.ts`

Updated the `checkDependencies()` method to:
- Query the database for integrations linked to the server via `linkedServerId`
- Return actual integration data including:
  - Integration ID, name, provider
  - Active status
  - Health status
- Maintain placeholder structure for future modules (Sites, Incidents, Jobs)

```typescript
async checkDependencies(id: string) {
  // Check if server exists
  const server = await this.prisma.server.findFirst({
    where: { id, deletedAt: null },
  });

  if (!server) {
    throw new ServerNotFoundException(id);
  }

  // Query integrations linked to this server
  const integrations = await this.prisma.integration.findMany({
    where: { linkedServerId: id },
    select: {
      id: true,
      name: true,
      provider: true,
      isActive: true,
      healthStatus: true,
    },
  });

  const hasDependencies = integrations.length > 0;

  return {
    serverId: id,
    hasDependencies,
    dependencies: {
      integrations: {
        count: integrations.length,
        items: integrations,
      },
      sites: { count: 0, items: [] },
      incidents: { count: 0, items: [] },
      jobs: { count: 0, items: [] },
    },
  };
}
```

### 2. Frontend Dependencies Tab Update
**File:** `frontend/components/servers/server-detail-tabs.tsx`

Enhanced the dependencies tab to:
- Display integrations in a card-based layout
- Show integration name, provider, active status, and health status
- Use color-coded badges for status indicators
- Maintain placeholders for future modules

Features:
- **Integration Cards:** Each integration displayed with:
  - Name and provider type
  - Active/Inactive badge
  - Health status badge (HEALTHY, DOWN, DEGRADED, UNKNOWN)
- **Empty State:** Shows "No dependencies" message when server has no linked resources
- **Responsive Layout:** Cards adapt to screen size

### 3. Real-Time Polling
**File:** `frontend/hooks/use-servers.ts`

Added automatic polling to `useServerDependencies` hook:
- Polls every 5 seconds for real-time updates
- Ensures dependencies tab stays current without manual refresh
- Consistent with other real-time features (metrics, test history)

```typescript
export function useServerDependencies(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: serverKeys.dependencies(id),
    queryFn: () => apiClient.getServerDependencies(id),
    enabled: options?.enabled !== false && !!id,
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
  });
}
```

## Database Schema Verification

Confirmed the Integration-Server relationship in `backend/prisma/schema.prisma`:

```prisma
model Integration {
  // ... other fields
  linkedServerId        String?
  linkedServer          Server?         @relation(fields: [linkedServerId], references: [id], onDelete: SetNull)
  // ... other fields
}

model Server {
  // ... other fields
  integrations          Integration[]
  // ... other fields
}
```

## Testing

### Manual Testing Steps:
1. Navigate to server detail page
2. Click on "Dependencies" tab
3. Verify integrations linked to the server are displayed
4. Create a new integration linked to the server
5. Verify the dependencies tab updates automatically within 5 seconds
6. Check that active/inactive and health status badges display correctly

### Expected Behavior:
- ✅ Dependencies tab shows all integrations linked to the server
- ✅ Integration cards display name, provider, status badges
- ✅ Tab updates automatically when integrations are added/removed
- ✅ Empty state shows when no dependencies exist
- ✅ No TypeScript errors or console warnings

## Future Enhancements

When implementing future modules, add queries for:
- **Module 4 (Sites):** Query sites hosted on the server
- **Module 5 (Jobs):** Query automation jobs targeting the server
- **Module 6 (Incidents):** Query active incidents related to the server

The structure is already in place in the response format:

```typescript
dependencies: {
  integrations: { count: X, items: [...] },
  sites: { count: 0, items: [] },        // TODO: Module 4
  incidents: { count: 0, items: [] },    // TODO: Module 6
  jobs: { count: 0, items: [] },         // TODO: Module 5
}
```

## Files Modified

1. `backend/src/modules/servers/servers.service.ts` - Updated checkDependencies method
2. `frontend/components/servers/server-detail-tabs.tsx` - Enhanced dependencies tab UI
3. `frontend/hooks/use-servers.ts` - Added real-time polling

## Status

✅ **COMPLETE** - Dependencies tab now properly displays and updates integrations linked to servers.

---

**Date:** February 10, 2026  
**Module:** Module 2 (Server Connection Management) + Module 3 (Integration Hub)  
**Related Issues:** Dependencies tab not updating, Integration-Server relationship not visible
