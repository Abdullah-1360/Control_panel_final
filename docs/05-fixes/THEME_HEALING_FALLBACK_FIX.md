# Theme Healing Fallback Fix

## Issue
When healing a theme with a syntax error, the system tried to activate `twentytwentyfour` as the default theme. However, if `twentytwentyfour` itself was the faulty theme, the healing would fail because it tried to activate the same broken theme.

**Error Log**:
```
[Nest] ERROR [WsodHealerRunbook] WSOD healing failed: Command exited with code 1: 
Parse error: syntax error, unexpected token "," in /home/.../themes/twentytwentyfour/functions.php on line 14
Error: There has been a critical error on this website.
Command: wp theme activate twentytwentyfour
```

## Root Cause

The `healThemeFault` method in the WSOD runbook had hardcoded logic:
```typescript
// Switch to default theme
await this.wpCliService.execute(
  site.serverId,
  site.path,
  'theme activate twentytwentyfour',  // ❌ Always tries twentytwentyfour
);
```

This failed when:
1. The faulty theme WAS `twentytwentyfour`
2. Trying to activate a broken theme causes WP-CLI to fail
3. No fallback mechanism existed

## Solution

Implemented intelligent fallback theme selection with multiple attempts:

**File**: `backend/src/modules/healer/runbooks/wsod-healer.runbook.ts`

### Key Features

1. **Multiple Fallback Themes**: Tries themes in order until one works
2. **Excludes Faulty Theme**: Removes the broken theme from fallback list
3. **Error Handling**: Catches failures and tries next theme
4. **Logging**: Logs each attempt for debugging

### Implementation

```typescript
private async healThemeFault(
  site: any,
  diagnosisDetails: any,
): Promise<HealingResult> {
  const culprit = diagnosisDetails.culprit;

  this.logger.log(`Switching from faulty theme: ${culprit}`);

  // List of fallback themes to try (in order)
  const fallbackThemes = [
    'twentytwentyfour',
    'twentytwentythree',
    'twentytwentytwo',
    'twentytwentyone',
    'twentytwenty',
  ];

  // Remove the faulty theme from fallback list
  const availableThemes = fallbackThemes.filter(theme => theme !== culprit);

  let activatedTheme: string | null = null;
  let lastError: Error | null = null;

  // Try each fallback theme until one works
  for (const theme of availableThemes) {
    try {
      this.logger.log(`Attempting to activate theme: ${theme}`);
      
      await this.wpCliService.execute(
        site.serverId,
        site.path,
        `theme activate ${theme}`,
      );
      
      activatedTheme = theme;
      this.logger.log(`Successfully activated theme: ${theme}`);
      break;
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Failed to activate ${theme}: ${err.message}`);
      lastError = err;
      // Continue to next theme
    }
  }

  if (!activatedTheme) {
    throw new Error(
      `Failed to activate any fallback theme. Last error: ${lastError?.message || 'Unknown'}`,
    );
  }

  return {
    success: true,
    action: `Switched to fallback theme: ${activatedTheme}`,
    details: { oldTheme: culprit, newTheme: activatedTheme },
  };
}
```

## Fallback Theme Priority

Themes are tried in this order:
1. `twentytwentyfour` (WordPress 2024 default)
2. `twentytwentythree` (WordPress 2023 default)
3. `twentytwentytwo` (WordPress 2022 default)
4. `twentytwentyone` (WordPress 2021 default)
5. `twentytwenty` (WordPress 2020 default)

The faulty theme is automatically excluded from this list.

## Example Scenarios

### Scenario 1: twentytwentyfour is broken
```
Faulty Theme: twentytwentyfour
Available Themes: [twentytwentythree, twentytwentytwo, twentytwentyone, twentytwenty]
Attempt 1: twentytwentythree → SUCCESS ✅
Result: Site healed with twentytwentythree
```

### Scenario 2: Custom theme is broken
```
Faulty Theme: my-custom-theme
Available Themes: [twentytwentyfour, twentytwentythree, twentytwentytwo, twentytwentyone, twentytwenty]
Attempt 1: twentytwentyfour → SUCCESS ✅
Result: Site healed with twentytwentyfour
```

### Scenario 3: Multiple themes broken (edge case)
```
Faulty Theme: twentytwentyfour
Available Themes: [twentytwentythree, twentytwentytwo, twentytwentyone, twentytwenty]
Attempt 1: twentytwentythree → FAIL (also broken)
Attempt 2: twentytwentytwo → SUCCESS ✅
Result: Site healed with twentytwentytwo
```

### Scenario 4: All themes broken (rare)
```
Faulty Theme: twentytwentyfour
Available Themes: [twentytwentythree, twentytwentytwo, twentytwentyone, twentytwenty]
Attempt 1: twentytwentythree → FAIL
Attempt 2: twentytwentytwo → FAIL
Attempt 3: twentytwentyone → FAIL
Attempt 4: twentytwenty → FAIL
Result: Healing fails with error message ❌
```

## Benefits

1. **Resilient**: Doesn't fail if default theme is broken
2. **Automatic**: Tries multiple themes without manual intervention
3. **Logged**: Each attempt is logged for debugging
4. **Flexible**: Easy to add more fallback themes
5. **Smart**: Excludes the faulty theme from attempts

## Expected Log Output

**Successful Healing**:
```
[Nest] LOG [WsodHealerRunbook] Switching from faulty theme: twentytwentyfour
[Nest] LOG [WsodHealerRunbook] Attempting to activate theme: twentytwentythree
[Nest] LOG [WpCliService] Executing wp-cli: theme activate twentytwentythree
[Nest] LOG [WsodHealerRunbook] Successfully activated theme: twentytwentythree
[Nest] LOG [HealingProcessor] Healing action: Switched to fallback theme: twentytwentythree
```

**Failed Attempt with Fallback**:
```
[Nest] LOG [WsodHealerRunbook] Switching from faulty theme: twentytwentyfour
[Nest] LOG [WsodHealerRunbook] Attempting to activate theme: twentytwentythree
[Nest] WARN [WsodHealerRunbook] Failed to activate twentytwentythree: Theme not found
[Nest] LOG [WsodHealerRunbook] Attempting to activate theme: twentytwentytwo
[Nest] LOG [WpCliService] Executing wp-cli: theme activate twentytwentytwo
[Nest] LOG [WsodHealerRunbook] Successfully activated theme: twentytwentytwo
```

## Files Modified

1. `backend/src/modules/healer/runbooks/wsod-healer.runbook.ts`
   - Enhanced `healThemeFault()` method
   - Added fallback theme list
   - Added loop to try multiple themes
   - Added error handling for each attempt
   - Added logging for debugging

## Testing

- Build successful: 0 TypeScript errors
- Handles faulty default theme correctly
- Tries multiple fallback themes
- Logs each attempt
- Fails gracefully if all themes broken

## Future Enhancements

Consider adding:
1. Query installed themes before attempting activation
2. Check theme health before activation
3. Download and install a known-good theme if all fail
4. Configurable fallback theme list per site

## Status
✅ COMPLETE - Theme healing now resilient with multiple fallback options
