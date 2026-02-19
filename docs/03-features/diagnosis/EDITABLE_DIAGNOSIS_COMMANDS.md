# Editable Diagnosis Commands

## Feature
Added the ability to view and edit suggested healing commands before execution in the diagnosis panel.

## Implementation

**File**: `frontend/components/healer/DiagnosisPanelExtensive.tsx`

### New State Variables
```typescript
const [editableCommands, setEditableCommands] = useState<string>(
  diagnosis.suggestedCommands.join('\n')
);
const [isEditingCommands, setIsEditingCommands] = useState(false);
const commandsModified = editableCommands !== diagnosis.suggestedCommands.join('\n');
```

### UI Components

#### 1. Edit/Preview Toggle Button
- Located next to "Commands to Execute" heading
- Toggles between edit mode and preview mode
- Shows "Edit" when in preview mode, "Preview" when in edit mode

#### 2. Editable Textarea (Edit Mode)
```typescript
<textarea
  value={editableCommands}
  onChange={(e) => setEditableCommands(e.target.value)}
  className="w-full min-h-[150px] bg-muted p-3 rounded-md text-sm font-mono"
  placeholder="Enter commands to execute..."
/>
```

Features:
- Multi-line text input
- Monospace font for command readability
- Minimum height of 150px
- Styled to match the preview mode

#### 3. Modified Badge
- Appears when commands have been edited
- Yellow outline badge with "Modified" text
- Provides visual feedback that commands differ from original

#### 4. Helper Text
```
Edit the commands above. Each line will be executed separately. 
Lines starting with # are comments and will be skipped.
```

#### 5. Limitation Notice (when modified)
```
Note: Command editing is currently for review purposes only. 
The system will execute the original suggested commands. 
Custom command execution will be available in a future update.
```

## User Experience

### View Mode (Default)
```
┌─────────────────────────────────────────┐
│ Commands to Execute          [Edit]     │
├─────────────────────────────────────────┤
│ # Option 1: Fix the syntax error        │
│ # Edit file: functions.php at line 14   │
│ # Option 2: Switch to default theme     │
│ wp theme activate twentytwentyfour      │
│ # Option 3: Reinstall the theme         │
│ wp theme delete twentytwentyfour --force│
│ wp theme install twentytwentyfour       │
└─────────────────────────────────────────┘
```

### Edit Mode
```
┌─────────────────────────────────────────┐
│ Commands to Execute  [Modified] [Preview]│
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ # Option 1: Fix the syntax error    │ │
│ │ # Edit file: functions.php line 14  │ │
│ │ # Option 2: Switch to default theme │ │
│ │ wp theme activate twentytwentythree │ │ <- User edited
│ │                                     │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│ Edit the commands above. Each line will │
│ be executed separately. Lines starting  │
│ with # are comments and will be skipped.│
│                                         │
│ ⚠️ Note: Command editing is currently   │
│ for review purposes only...             │
└─────────────────────────────────────────┘
```

## Benefits

1. **Transparency**: Users can see exactly what commands will be executed
2. **Review**: Users can review and understand the healing strategy
3. **Documentation**: Commands serve as documentation of the healing process
4. **Future-Ready**: UI prepared for custom command execution feature

## Current Limitations

### Phase 1 (Current Implementation)
- Commands are editable in the UI
- Visual feedback when commands are modified
- Warning message about limitation
- Original commands are still executed (editing is for review only)

### Phase 2 (Future Enhancement)
To enable actual custom command execution, we need to:

1. **Backend API Update**: Modify the heal endpoint to accept custom commands
```typescript
// POST /api/v1/healer/sites/:id/heal
{
  executionId: string;
  customCommands?: string[];  // Optional custom commands
}
```

2. **Runbook Update**: Modify runbooks to use custom commands if provided
```typescript
async execute(context: HealingContext, customCommands?: string[]): Promise<HealingResult> {
  const commands = customCommands || this.getDefaultCommands(context);
  // Execute commands
}
```

3. **Frontend Update**: Pass edited commands to the heal mutation
```typescript
const healMutation = useMutation({
  mutationFn: async () => {
    const commands = editableCommands.split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('#'));
    
    const response = await fetch(`/api/v1/healer/sites/${siteId}/heal`, {
      method: 'POST',
      body: JSON.stringify({ 
        executionId,
        customCommands: commandsModified ? commands : undefined
      }),
    });
    // ...
  }
});
```

4. **Safety Measures**:
   - Command validation (whitelist of allowed commands)
   - Dangerous command warnings (rm, dd, etc.)
   - Confirmation dialog for custom commands
   - Audit logging of custom command execution

## Use Cases

### Use Case 1: Review Before Healing
User wants to understand what will happen before clicking "Fix Now"
- Click "Edit" to see commands in detail
- Review each command
- Click "Preview" to return to view mode
- Click "Fix Now" with confidence

### Use Case 2: Learn Healing Strategies
User wants to learn how the system heals issues
- View suggested commands
- Understand the healing strategy
- Apply knowledge to manual fixes

### Use Case 3: Prepare for Custom Commands (Future)
User wants to modify the healing approach
- Edit commands to use different theme
- Add additional safety checks
- Remove commands they don't want to execute
- Execute custom healing strategy

## Example Scenarios

### Scenario 1: Theme Syntax Error
**Original Commands**:
```bash
# Option 1: Fix the syntax error manually
# Edit file: /home/.../functions.php at line 14
# Option 2: Switch to default theme
wp theme activate twentytwentyfour
# Option 3: Reinstall the theme
wp theme delete twentytwentyfour --force
wp theme install twentytwentyfour --activate
```

**User Edits** (for future use):
```bash
# I prefer twentytwentythree
wp theme activate twentytwentythree
```

### Scenario 2: Plugin Error
**Original Commands**:
```bash
# Option 1: Deactivate faulty plugin
wp plugin deactivate woocommerce
# Option 2: Reinstall the plugin
wp plugin delete woocommerce --force
wp plugin install woocommerce --activate
```

**User Edits** (for future use):
```bash
# Just deactivate, don't reinstall
wp plugin deactivate woocommerce
```

## Files Modified

1. `frontend/components/healer/DiagnosisPanelExtensive.tsx`
   - Added `editableCommands` state
   - Added `isEditingCommands` state
   - Added `commandsModified` computed value
   - Added Edit/Preview toggle button
   - Added editable textarea
   - Added modified badge
   - Added helper text
   - Added limitation notice

## Testing

- No TypeScript errors
- Commands display correctly in view mode
- Edit mode shows textarea with commands
- Toggle between edit and preview works
- Modified badge appears when commands changed
- Helper text and limitation notice display correctly

## Status
✅ COMPLETE - Phase 1 (UI for editing, review purposes only)
🔄 PLANNED - Phase 2 (Backend support for custom command execution)
