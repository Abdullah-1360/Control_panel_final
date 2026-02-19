# Manual Diagnosis Mode - Backend Implementation Complete

## Status: ✅ BACKEND COMPLETE (Frontend Pending)

The backend for manual diagnosis mode with self-learning integration has been successfully implemented.

## What Was Implemented

### 1. Database Schema ✅

**Migration**: `20260215171244_add_manual_diagnosis_and_verified_patterns`

**New Model: `ManualDiagnosisSession`**
- Stores interactive diagnosis sessions
- Tracks command executions with outputs
- Supports ACTIVE, AUTO_MODE, COMPLETED, CANCELLED states
- Links to learned patterns

**Updated Model: `HealingPattern`**
- Added `verified` field (true for manual diagnosis patterns)
- Added `commandSequence` field (ordered commands)
- Added `verifiedBy` and `verifiedAt` fields
- Verified patterns start at 80% confidence

### 2. ManualDiagnosisService ✅

**File**: `backend/src/modules/healer/services/manual-diagnosis.service.ts`

**Key Methods:**
- `startManualDiagnosis(siteId)` - Initialize interactive session
- `executeCommand(sessionId, command)` - Run command via SSH
- `suggestNextCommand(sessionId, lastCommand, lastOutput)` - AI-powered suggestions
- `switchToAutoMode(sessionId)` - Continue automatically from current state
- `completeManualDiagnosis(sessionId, findings)` - Finalize and learn
- `getSession(sessionId)` - Get session details

**Features:**
- Real-time command execution via SSH
- Output analysis to determine next steps
- Pattern-based suggestions (top 3)
- Rule-based fallback suggestions
- Learning from successful sessions
- Verified patterns with 80% starting confidence

### 3. API Endpoints ✅

**New Endpoints:**
- `POST /api/v1/healer/sites/:id/diagnose/manual` - Start manual diagnosis
- `POST /api/v1/healer/manual/:sessionId/execute` - Execute command
- `POST /api/v1/healer/manual/:sessionId/suggest` - Get suggestions
- `POST /api/v1/healer/manual/:sessionId/auto` - Switch to auto mode
- `POST /api/v1/healer/manual/:sessionId/complete` - Complete session
- `GET /api/v1/healer/manual/:sessionId` - Get session details

### 4. Pattern Learning Integration ✅

**Verified Patterns:**
- Manual diagnosis creates verified patterns
- Start at 80% confidence (vs 0% for auto)
- Marked with `verified: true` flag
- Higher priority in suggestions
- Include full command sequence

**Learning Flow:**
```
Manual Diagnosis → Commands Executed → Session Completed → Pattern Created
                                                                ↓
                                                    Verified: true
                                                    Confidence: 0.8
                                                    CommandSequence: [...]
```

### 5. Command Suggestion Algorithm ✅

**Priority Order:**
1. Verified patterns from manual diagnosis (highest priority)
2. Unverified patterns from auto diagnosis
3. Rule-based suggestions (fallback)

**Top 3 Suggestions:**
- Shows best 3 learned patterns
- Includes confidence score
- Shows if pattern is verified
- Provides description/reasoning

**Suggestion Response:**
```typescript
{
  command: "tail -100 /path/to/debug.log",
  description: "Verified: Check WordPress debug log",
  confidence: 0.85,
  patternId: "abc123",
  isVerified: true
}
```

### 6. Auto Mode Transition ✅

**Behavior:**
- Continues from where manual left off
- Uses learned patterns for remaining steps
- Shows each step as it executes
- Stops on first failure
- Returns all results

## API Usage Examples

### Start Manual Diagnosis

```bash
POST /api/v1/healer/sites/4fccd481-8729-4041-926e-011d34ba72cb/diagnose/manual
Authorization: Bearer <token>

Response:
{
  "data": {
    "sessionId": "session-123",
    "site": {
      "id": "4fccd481-8729-4041-926e-011d34ba72cb",
      "domain": "zergaan.com",
      "path": "/home/zergaanc/public_html"
    },
    "suggestions": [
      {
        "command": "tail -100 /home/zergaanc/public_html/wp-content/debug.log",
        "description": "Verified: Check WordPress debug log",
        "confidence": 0.85,
        "isVerified": true
      },
      {
        "command": "tail -100 /var/log/apache2/error.log",
        "description": "Check web server error log"
      }
    ]
  }
}
```

### Execute Command

```bash
POST /api/v1/healer/manual/session-123/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "command": "tail -100 /home/zergaanc/public_html/wp-content/debug.log"
}

Response:
{
  "data": {
    "success": true,
    "output": "[15-Feb-2026 22:00:00 UTC] PHP Fatal error: ...",
    "duration": 1234,
    "nextSuggestions": [
      {
        "command": "grep -i 'plugin' /home/zergaanc/public_html/wp-content/debug.log",
        "description": "Check for plugin-related errors"
      }
    ]
  }
}
```

### Switch to Auto Mode

```bash
POST /api/v1/healer/manual/session-123/auto
Authorization: Bearer <token>

Response:
{
  "data": {
    "sessionId": "session-123",
    "status": "AUTO_MODE",
    "results": [
      {
        "success": true,
        "output": "...",
        "duration": 1000
      }
    ]
  }
}
```

### Complete Manual Diagnosis

```bash
POST /api/v1/healer/manual/session-123/complete
Authorization: Bearer <token>
Content-Type: application/json

{
  "findings": {
    "diagnosisType": "WSOD",
    "errorType": "PLUGIN_FAULT",
    "culprit": "problematic-plugin",
    "description": "Plugin causing fatal error",
    "errorPattern": "Fatal error.*problematic-plugin"
  }
}

Response:
{
  "data": {
    "sessionId": "session-123",
    "status": "COMPLETED",
    "learnedPattern": {
      "id": "pattern-456",
      "confidence": 0.8,
      "verified": true
    }
  }
}
```

## Backend Status

✅ Database schema migrated
✅ ManualDiagnosisService implemented
✅ API endpoints registered
✅ Pattern learning integrated
✅ Backend rebuilt and running on `http://localhost:3001`

**New Endpoints Registered:**
- `/api/v1/healer/sites/:id/diagnose/manual` (POST)
- `/api/v1/healer/manual/:sessionId/execute` (POST)
- `/api/v1/healer/manual/:sessionId/suggest` (POST)
- `/api/v1/healer/manual/:sessionId/auto` (POST)
- `/api/v1/healer/manual/:sessionId/complete` (POST)
- `/api/v1/healer/manual/:sessionId` (GET)

## Next Steps: Frontend Implementation

### Required Components

1. **ManualDiagnosisPanel Component**
   - Command input/editor with syntax highlighting
   - Output display (modern card-based, not terminal)
   - Top 3 suggested commands as buttons
   - "Continue in Auto Mode" button
   - Command history timeline

2. **Page: `/healer/sites/[id]/diagnose/manual`**
   - Full manual diagnosis interface
   - Real-time command execution
   - Pattern suggestions with confidence
   - Auto mode transition

3. **Update DiagnosisPanel**
   - Add "Try Manual Diagnosis" button
   - Show when patterns are verified
   - Link to manual diagnosis page

### Frontend Features

- **Command Suggestions**: Show top 3 as clickable buttons
- **Custom Commands**: Allow user to type/edit commands
- **Output Display**: Modern cards with syntax highlighting
- **Pattern Indicators**: Show verified badge and confidence
- **Auto Mode**: Smooth transition with progress indicator
- **Command History**: Timeline view of executed commands

## Files Created/Modified

### Backend
- ✅ `backend/prisma/schema.prisma` (updated)
- ✅ `backend/prisma/migrations/20260215171244_add_manual_diagnosis_and_verified_patterns/` (created)
- ✅ `backend/src/modules/healer/services/manual-diagnosis.service.ts` (created)
- ✅ `backend/src/modules/healer/healer.module.ts` (updated)
- ✅ `backend/src/modules/healer/healer.controller.ts` (updated)

### Documentation
- ✅ `MANUAL_DIAGNOSIS_BACKEND_COMPLETE.md` (this file)

## Testing the Backend

### Test 1: Start Manual Diagnosis

```bash
curl -X POST http://localhost:3001/api/v1/healer/sites/SITE_ID/diagnose/manual \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json"
```

### Test 2: Execute Command

```bash
curl -X POST http://localhost:3001/api/v1/healer/manual/SESSION_ID/execute \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "ls -la /home/user/public_html"}'
```

### Test 3: Get Suggestions

```bash
curl -X POST http://localhost:3001/api/v1/healer/manual/SESSION_ID/suggest \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"lastCommand": "tail debug.log", "lastOutput": "Fatal error..."}'
```

## Summary

The backend for manual diagnosis mode is complete and ready for frontend integration. The system now supports:

✅ Interactive command-by-command diagnosis
✅ AI-powered command suggestions (top 3)
✅ Verified patterns from manual diagnosis (80% confidence)
✅ Auto mode transition from any point
✅ Full learning integration with existing pattern system
✅ Real-time SSH command execution

The frontend implementation can now begin using these endpoints to create the interactive manual diagnosis UI.
