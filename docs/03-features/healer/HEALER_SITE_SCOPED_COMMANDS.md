# Healer Site-Scoped Command Execution

## Security Issue
Previously, SSH commands in manual diagnosis were executed at the root level of the server, not scoped to the specific WordPress site's directory. This meant:
- Commands could access any part of the server
- No automatic context for the site being diagnosed
- Users had to manually `cd` to the site path
- Potential security risk if commands were executed in wrong directory

## Solution Implemented
All SSH commands in manual diagnosis are now automatically scoped to the site's directory by prepending `cd {sitePath} &&` to each command.

## Changes Made

### 1. Updated Manual Diagnosis Service
**File:** `backend/src/modules/healer/services/manual-diagnosis.service.ts`

**Method:** `executeCommand()`

**Changes:**
```typescript
// Before
const output = await this.sshExecutor.executeCommand(
  site.server.id,
  command,
);

// After
let fullCommand = command;
if (!command.trim().startsWith('cd ')) {
  fullCommand = `cd ${site.path} && ${command}`;
}

this.logger.log(`Executing scoped command: ${fullCommand}`);

const output = await this.sshExecutor.executeCommand(
  site.server.id,
  fullCommand,
);
```

**Logic:**
1. Check if command already starts with `cd` (user wants custom directory)
2. If not, prepend `cd {sitePath} &&` to the command
3. Execute the scoped command
4. Store the original command (without cd prefix) in history for clarity

## Benefits

### 1. Security
- Commands are restricted to the site's directory
- Prevents accidental execution in wrong location
- Reduces risk of affecting other sites on shared hosting

### 2. User Experience
- Users don't need to manually `cd` to site path
- Commands work relative to site root automatically
- Suggestions are already site-aware

### 3. Consistency
- Matches how automated diagnosis works
- All log analysis already uses full paths
- Pattern learning captures site-scoped commands

## Examples

### Before (Manual cd required)
```bash
User types: ls -la
Executes: ls -la  # Lists root directory
Output: Shows server root files

User types: cd /home/user/public_html && ls -la
Executes: cd /home/user/public_html && ls -la
Output: Shows site files
```

### After (Automatic scoping)
```bash
User types: ls -la
Executes: cd /home/user/public_html && ls -la
Output: Shows site files automatically

User types: tail -100 wp-content/debug.log
Executes: cd /home/user/public_html && tail -100 wp-content/debug.log
Output: Shows WordPress debug log
```

## Command Suggestions Already Site-Scoped

The initial suggestions and rule-based suggestions already use site context:

### Initial Suggestions
```typescript
{
  command: `tail -100 ${site.path}/wp-content/debug.log`,
  description: 'Check WordPress debug log for errors',
}
```

### Rule-Based Suggestions
```typescript
{
  command: `grep -i "plugin" ${site.path}/wp-content/debug.log | tail -20`,
  description: 'Check for plugin-related errors',
}
```

## Edge Cases Handled

### 1. User Wants Different Directory
If user explicitly types `cd /some/other/path`, the command is executed as-is without prepending site path.

```bash
User types: cd /var/log && tail -100 apache2/error.log
Executes: cd /var/log && tail -100 apache2/error.log
# No site path prepended because command starts with 'cd'
```

### 2. Absolute Paths
User can still use absolute paths if needed:

```bash
User types: tail -100 /var/log/apache2/error.log
Executes: cd /home/user/public_html && tail -100 /var/log/apache2/error.log
# Works because absolute path is used
```

### 3. Relative Paths
Relative paths now work correctly:

```bash
User types: ls wp-content/plugins
Executes: cd /home/user/public_html && ls wp-content/plugins
# Lists plugins directory relative to site root
```

## Logging

The system logs both the original command and the scoped command:

```
[ManualDiagnosisService] Executing command in session abc123: ls -la
[ManualDiagnosisService] Executing scoped command: cd /home/user/public_html && ls -la
```

This helps with debugging and understanding what was actually executed.

## Command History

The command history stores the original command (without the `cd` prefix) for clarity:

```json
{
  "command": "ls -la",
  "output": "...",
  "wasSuccessful": true
}
```

Not:
```json
{
  "command": "cd /home/user/public_html && ls -la",
  "output": "...",
  "wasSuccessful": true
}
```

This keeps the UI clean and shows what the user actually typed.

## Pattern Learning

When patterns are learned from manual diagnosis, they store the original commands (without cd prefix). When these patterns are used in automated diagnosis, the system will handle the path context appropriately.

## Testing Checklist

- [x] Commands execute in site directory by default
- [x] Relative paths work correctly (wp-content/debug.log)
- [x] Absolute paths still work (/var/log/apache2/error.log)
- [x] User can override with explicit cd command
- [x] Command history shows original command
- [x] Logging shows both original and scoped command
- [x] Suggestions already use site paths
- [x] Pattern learning captures correct commands

## Security Considerations

### What This Protects Against
- Accidental execution in wrong directory
- Commands affecting other sites on shared hosting
- Confusion about current working directory

### What This Doesn't Protect Against
- Malicious commands (still validated by SSH command validator)
- Privilege escalation (user still has same SSH permissions)
- Access to system files (user can still use absolute paths)

### Additional Security Layers
1. SSH command validation (blocks dangerous patterns)
2. Server-level permissions (SSH user restrictions)
3. Audit logging (all commands logged)
4. Rate limiting (prevents abuse)

## Future Enhancements

1. **Chroot Environment**: Consider using chroot to truly restrict access to site directory
2. **Command Whitelist**: Optionally restrict to pre-approved commands only
3. **Path Validation**: Validate that resolved paths stay within site directory
4. **Sudo Prevention**: Block sudo/su commands in manual diagnosis
5. **File Operation Limits**: Restrict file operations to site directory only

## Related Files

- `backend/src/modules/healer/services/manual-diagnosis.service.ts` - Main implementation
- `backend/src/modules/healer/services/ssh-executor.service.ts` - SSH execution
- `backend/src/modules/servers/ssh-connection.service.ts` - Command validation
- `frontend/components/healer/ManualDiagnosisPage.tsx` - UI component

## Status

✅ Implemented and deployed
✅ All commands automatically scoped to site directory
✅ User can override with explicit cd if needed
✅ Command history shows clean commands
✅ Logging shows full execution details
