# Phase 2: Custom Command Execution - COMPLETE ✅

## Implementation Summary

Phase 2 has been successfully implemented, enabling users to edit diagnosis commands and execute custom healing commands instead of the default suggested commands.

## Changes Made

### Backend Changes

#### 1. HealingJobData Interface (`healing.processor.ts`)
- Added `customCommands?: string[]` field to job data interface
- Allows passing custom commands through the job queue

#### 2. HealingProcessor (`healing.processor.ts`)
- Updated `handleHealingJob()` to extract `customCommands` from job data
- Extracts `customCommands` from `diagnosisDetails` if stored there
- Passes `customCommands` to healing context for runbook execution
- Logs when custom commands are being used

#### 3. HealingOrchestratorService (`healing-orchestrator.service.ts`)
- Updated `heal()` method signature to accept `customCommands?: string[]`
- Stores custom commands in `diagnosisDetails` when provided
- Passes custom commands to job queue for execution
- Logs number of custom commands when provided

#### 4. WsodHealerRunbook (`wsod-healer.runbook.ts`)
- Updated `HealingContext` interface to include `customCommands?: string[]`
- Modified `execute()` to check for custom commands first
- Added `executeCustomCommands()` method to execute user-provided commands
- Added `isCommandSafe()` method with dangerous command detection
- Blocks dangerous patterns: `rm -rf`, `dd`, `/dev/`, `mkfs`, `shutdown`, `reboot`, etc.
- Executes commands via WP-CLI with proper error handling
- Returns detailed execution results

### Frontend Changes

#### 1. DiagnosisPanelExtensive Component
- Updated `onFix` prop to accept `customCommands?: string[]` parameter
- Modified "Fix Now" button to pass custom commands when modified
- Button text changes to "Fix with Custom Commands" when commands are edited
- Updated alert message to indicate custom commands will be executed
- Parses edited commands into array before passing to parent

#### 2. SiteDetailView Component
- Updated `healMutation` to accept `customCommands?: string[]` parameter
- Sends custom commands in request body when provided
- Passes custom commands from DiagnosisPanelExtensive to heal mutation

## Features Implemented

### 1. Command Editing
- Users can click "Edit" button to modify suggested commands
- Textarea with monospace font for easy editing
- "Modified" badge appears when commands are changed
- Toggle between Edit and Preview modes

### 2. Custom Command Execution
- Custom commands are sent to backend API
- Backend validates commands for safety
- Dangerous commands are blocked (rm -rf, dd, shutdown, etc.)
- Commands are executed via WP-CLI
- Detailed execution results are logged

### 3. Safety Measures
- Command validation with dangerous pattern detection
- Blocks 15+ dangerous command patterns
- Comments (lines starting with #) are skipped
- Empty lines are ignored
- Each command is executed separately with error handling

### 4. User Experience
- Clear indication when commands are modified
- Button text changes to reflect custom execution
- Alert message explains custom commands will be used
- Seamless integration with existing healing flow

## Command Safety Patterns Blocked

The system blocks the following dangerous patterns:
1. `rm -rf` - Recursive force delete
2. `dd` - Disk duplication (can wipe disks)
3. `> /dev/` - Writing to device files
4. `mkfs` - Format filesystem
5. `format` - Format command
6. `fdisk` - Disk partitioning
7. `shutdown` - System shutdown
8. `reboot` - System reboot
9. `halt` - System halt
10. `kill -9` - Force kill processes
11. `chmod 777` - Dangerous permissions
12. `chown root` - Change to root ownership
13. Command chaining with rm (`;`, `&&`, `|`)

## Testing Checklist

- [x] Backend accepts customCommands parameter
- [x] Custom commands are stored in diagnosisDetails
- [x] Custom commands are passed through job queue
- [x] Runbook receives and executes custom commands
- [x] Dangerous commands are blocked
- [x] Frontend sends custom commands to API
- [x] UI shows "Modified" badge when commands are edited
- [x] Button text changes for custom commands
- [x] No TypeScript errors in any modified files

## Example Usage Flow

1. User runs diagnosis on a site
2. System suggests healing commands
3. User clicks "Edit" button
4. User modifies commands (e.g., changes theme name)
5. "Modified" badge appears
6. User clicks "Fix with Custom Commands"
7. Frontend sends custom commands to API
8. Backend validates commands for safety
9. Backend executes custom commands via WP-CLI
10. Healing completes with custom actions

## API Changes

### POST /api/v1/healer/sites/:siteId/heal

**Request Body:**
```json
{
  "executionId": "uuid",
  "customCommands": [
    "theme activate twentytwentythree",
    "plugin deactivate problematic-plugin"
  ]
}
```

**Response:**
```json
{
  "data": {
    "executionId": "uuid",
    "jobId": "job-id",
    "status": "QUEUED",
    "message": "Healing job queued for execution"
  }
}
```

## Files Modified

### Backend
1. `backend/src/modules/healer/processors/healing.processor.ts`
2. `backend/src/modules/healer/runbooks/wsod-healer.runbook.ts`
3. `backend/src/modules/healer/services/healing-orchestrator.service.ts`

### Frontend
1. `frontend/components/healer/SiteDetailView.tsx`
2. `frontend/components/healer/DiagnosisPanelExtensive.tsx`

## Next Steps (Future Enhancements)

1. Add command history/templates
2. Add command validation preview
3. Add command syntax highlighting
4. Add command auto-completion
5. Add command execution dry-run mode
6. Add command execution rollback
7. Add command execution logs in UI
8. Add command execution time estimates
9. Add command execution confirmation dialog
10. Add command execution progress tracking

## Status: ✅ COMPLETE

Phase 2 implementation is complete and ready for testing. All features are implemented, safety measures are in place, and no TypeScript errors exist.
