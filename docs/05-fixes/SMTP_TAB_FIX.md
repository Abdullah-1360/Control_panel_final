# SMTP Settings Validation Error Fix

## Problem
When saving SMTP settings, the API returned validation error:
```
property isConfigured should not exist
```

## Root Cause
The frontend was sending the entire `settings` object (including `isConfigured`) to the backend API. However, `isConfigured` is a **computed field** that should only exist in the response, not in the request body.

### Backend DTO Structure
```typescript
// Request DTO (SmtpSettingsDto) - Does NOT include isConfigured
export class SmtpSettingsDto {
  host: string;
  port: number;
  username?: string;
  password?: string;
  fromAddress: string;
  fromName: string;
  secure: boolean;
  // isConfigured NOT allowed here
}

// Response DTO (SmtpSettingsResponseDto) - Includes isConfigured
export class SmtpSettingsResponseDto {
  host: string;
  port: number;
  username?: string;
  fromAddress: string;
  fromName: string;
  secure: boolean;
  isConfigured: boolean; // Computed by backend
}
```

### Frontend Issue
```typescript
// BEFORE (WRONG) - Sends isConfigured
const updated = await apiClient.updateSmtpSettings(settings)

// settings object includes:
{
  host: "smtp.gmail.com",
  port: 587,
  username: "user@example.com",
  password: "password",
  fromAddress: "noreply@opsmanager.local",
  fromName: "OpsManager",
  secure: true,
  isConfigured: true  // ❌ This causes validation error
}
```

## Solution
Exclude `isConfigured` from the request body using object destructuring:

```typescript
// AFTER (CORRECT) - Excludes isConfigured
const { isConfigured, ...settingsToSave } = settings
const updated = await apiClient.updateSmtpSettings(settingsToSave)

// settingsToSave object:
{
  host: "smtp.gmail.com",
  port: 587,
  username: "user@example.com",
  password: "password",
  fromAddress: "noreply@opsmanager.local",
  fromName: "OpsManager",
  secure: true
  // isConfigured excluded ✅
}
```

## Files Modified
- `frontend/components/dashboard/smtp-settings-view.tsx`
  - Updated `handleSave()` to exclude `isConfigured` from request

## Testing
1. Login as SUPER_ADMIN: admin@opsmanager.local / Password123!
2. Navigate to Settings → SMTP Configuration
3. Fill in SMTP settings:
   - Host: smtp.gmail.com
   - Port: 587
   - Username: your-email@gmail.com
   - Password: your-app-password
   - From Address: noreply@opsmanager.local
   - From Name: OpsManager
   - Secure: ON
4. Click "Save SMTP Settings"
5. ✅ Should save successfully without validation error
6. ✅ `isConfigured` should be `true` in the response

## Key Takeaway
**Computed fields** (fields calculated by the backend) should:
- ✅ Be included in response DTOs
- ❌ NOT be included in request DTOs
- ❌ NOT be sent from frontend to backend

Always destructure and exclude computed fields before sending API requests.

---
**Status:** ✅ FIXED
**Date:** February 8, 2026
