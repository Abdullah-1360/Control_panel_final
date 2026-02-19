# Theme Syntax Error Healing Fix - COMPLETE ✅

## Problem
When a WordPress theme has a syntax error, attempting to switch themes fails because WordPress loads the faulty theme's code during the switch operation, causing the error to persist.

## Root Cause
WordPress loads the active theme's functions.php file even when trying to activate a different theme, so syntax errors in the current theme prevent theme switching via WP-CLI.

## Solution Implemented

### 1. Updated Diagnosis Commands
Changed suggested healing commands to:
1. **Rename faulty theme directory** (e.g., `mv wp-content/themes/twentytwentyfour wp-content/themes/twentytwentyfour.disabled`)
2. **Then activate default theme** (`wp theme activate twentytwentyfour`)

This prevents WordPress from loading the faulty theme's code.

### 2. Support for Shell Commands
- Custom command execution now supports both WP-CLI and shell commands
- Commands starting with "wp " are executed via WpCliService
- Other commands are executed as shell commands via SshExecutorService
- Shell commands run in site directory context (`cd {site.path} && {command}`)

### 3. Enhanced Command Safety
- Updated dangerous pattern detection
- More specific rm -rf patterns (blocks rm -rf and rm -fr)
- Blocks rm with root directory or parent traversal
- Allows safe commands like `mv` for renaming directories

## Changes Made

### Backend
1. `diagnosis.service.ts` - Updated createThemeFaultDiagnosis() with new command strategy
2. `wsod-healer.runbook.ts` - Added shell command support in executeCustomCommands()
3. `wsod-healer.runbook.ts` - Enhanced command safety validation

## New Healing Flow

### For Theme Syntax Errors:
```bash
# Step 1: Disable faulty theme by renaming
mv wp-content/themes/twentytwentyfour wp-content/themes/twentytwentyfour.disabled

# Step 2: Activate default theme
wp theme activate twentytwentyfour

# Step 3 (optional): Reinstall clean theme
wp theme install twentytwentyfour
```

## Command Type Detection
- **WP-CLI commands**: Start with "wp " → executed via WpCliService
- **Shell commands**: Everything else → executed via SshExecutorService in site directory

## Safety Validation
Blocks:
- `rm -rf` and `rm -fr`
- `rm` with root directory
- `rm` with parent directory traversal
- `dd`, `mkfs`, `format`, `fdisk`
- `shutdown`, `reboot`, `halt`
- `kill -9`
- `chmod 777`, `chown root`
- Command chaining with dangerous rm operations

Allows:
- `mv` (rename/move files)
- `cp` (copy files)
- `mkdir` (create directories)
- All WP-CLI commands
- Other safe shell commands

## Testing
- Theme syntax errors can now be healed by renaming theme directory
- Shell commands execute correctly in site directory context
- Command safety validation works for both WP-CLI and shell commands
