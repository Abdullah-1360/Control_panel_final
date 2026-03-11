# Healer Toggles Explanation

## 🎯 Two Healer Toggles - What They Do

Based on the screenshot and implementation, there are **two healer toggles** with different purposes:

---

## 1. **"Healer Off" (Top-Right Corner)** - Global Application Toggle

### Location
Top-right corner of the application details page, next to "Run Diagnosis" and "Configure"

### Purpose
**Master switch for the entire healing system for this application**

### What It Controls
- **Field**: `isHealerEnabled` (Boolean)
- **Scope**: Application-level (affects the entire site)
- **Default**: `false` (disabled)

### Behavior

#### When ENABLED (`isHealerEnabled = true`)
✅ **Automated healing triggers are allowed**:
- SEMI_AUTO trigger: ✅ Allowed
- FULL_AUTO trigger: ✅ Allowed
- SEARCH trigger: ✅ Allowed
- MANUAL trigger: ✅ Always allowed (regardless of toggle)

#### When DISABLED (`isHealerEnabled = false`)
❌ **Automated healing triggers are blocked**:
- SEMI_AUTO trigger: ❌ Blocked
- FULL_AUTO trigger: ❌ Blocked
- SEARCH trigger: ❌ Blocked
- MANUAL trigger: ✅ Still allowed (user can manually trigger healing)

### Use Cases
- **Enable**: When you want the system to automatically heal issues
- **Disable**: When you want to prevent automatic healing (e.g., during maintenance, testing, or when you want manual control only)

---

## 2. **"Auto Healer - Disabled" (Details Section)** - Healing Mode Selector

### Location
In the "Details" section, below the health status bar

### Purpose
**Controls the healing automation level/mode**

### What It Controls
- **Field**: `healingMode` (Enum)
- **Scope**: Application-level
- **Default**: `MANUAL`

### Available Modes

#### 1. **MANUAL** (Default)
- **Label**: "Auto Healer - Disabled"
- **Behavior**: No automatic healing, only manual triggers
- **Use Case**: Full manual control, no automation

#### 2. **SEMI_AUTO**
- **Label**: "Auto Healer - Semi-Automatic"
- **Behavior**: System suggests healing actions, requires approval before execution
- **Use Case**: Automated detection with manual approval

#### 3. **FULL_AUTO**
- **Label**: "Auto Healer - Fully Automatic"
- **Behavior**: System automatically detects and heals issues without approval
- **Use Case**: Fully automated healing for trusted environments

### Relationship with Toggle #1
This mode **only works if Toggle #1 (`isHealerEnabled`) is ENABLED**. If `isHealerEnabled = false`, the healing mode is ignored for automated triggers.

---

## 🔄 How They Work Together

### Scenario 1: Both Disabled
```
isHealerEnabled = false
healingMode = MANUAL
```
**Result**: Only manual healing allowed, no automation

### Scenario 2: Toggle Enabled, Mode Manual
```
isHealerEnabled = true
healingMode = MANUAL
```
**Result**: Only manual healing allowed (mode overrides the enabled toggle)

### Scenario 3: Toggle Enabled, Mode Semi-Auto
```
isHealerEnabled = true
healingMode = SEMI_AUTO
```
**Result**: Automated detection + manual approval required

### Scenario 4: Toggle Enabled, Mode Full-Auto
```
isHealerEnabled = true
healingMode = FULL_AUTO
```
**Result**: Fully automated healing (detection + execution)

### Scenario 5: Toggle Disabled, Mode Full-Auto
```
isHealerEnabled = false
healingMode = FULL_AUTO
```
**Result**: Only manual healing allowed (toggle blocks automation)

---

## 📊 Validation Logic

### Implementation (from code)
```typescript
private async validateAutoHeal(
  application: any,
  trigger: HealerTrigger
): Promise<boolean> {
  // Manual triggers always allowed (user explicitly requested)
  if (trigger === HealerTrigger.MANUAL) {
    return true; // ✅ Always allowed
  }
  
  // For automated triggers, check if healer is enabled
  if (!application.isHealerEnabled) {
    return false; // ❌ Blocked if toggle is OFF
  }
  
  return true; // ✅ Allowed if toggle is ON
}
```

### Trigger Types
1. **MANUAL**: User clicks "Heal Now" button → Always allowed
2. **SEMI_AUTO**: System detects issue, asks for approval → Requires `isHealerEnabled = true`
3. **FULL_AUTO**: System detects and heals automatically → Requires `isHealerEnabled = true`
4. **SEARCH**: Scheduled/background healing → Requires `isHealerEnabled = true`

---

## 🎯 Recommended Usage

### Development/Testing Environment
```
Toggle #1 (isHealerEnabled): OFF
Toggle #2 (healingMode): MANUAL
```
**Why**: Full manual control, no surprises during development

### Staging Environment
```
Toggle #1 (isHealerEnabled): ON
Toggle #2 (healingMode): SEMI_AUTO
```
**Why**: Automated detection with manual approval before healing

### Production Environment (Low-Risk Sites)
```
Toggle #1 (isHealerEnabled): ON
Toggle #2 (healingMode): FULL_AUTO
```
**Why**: Fully automated healing for maximum uptime

### Production Environment (High-Risk Sites)
```
Toggle #1 (isHealerEnabled): ON
Toggle #2 (healingMode): SEMI_AUTO
```
**Why**: Automated detection but manual approval for critical sites

### Maintenance Mode
```
Toggle #1 (isHealerEnabled): OFF
Toggle #2 (healingMode): MANUAL
```
**Why**: Prevent automatic healing during maintenance

---

## 🔍 Quick Reference Table

| Toggle #1 (isHealerEnabled) | Toggle #2 (healingMode) | Manual Healing | Auto Detection | Auto Execution |
|----------------------------|------------------------|----------------|----------------|----------------|
| OFF | MANUAL | ✅ | ❌ | ❌ |
| OFF | SEMI_AUTO | ✅ | ❌ | ❌ |
| OFF | FULL_AUTO | ✅ | ❌ | ❌ |
| ON | MANUAL | ✅ | ❌ | ❌ |
| ON | SEMI_AUTO | ✅ | ✅ | ⚠️ (requires approval) |
| ON | FULL_AUTO | ✅ | ✅ | ✅ |

---

## 💡 Key Takeaways

### Toggle #1: "Healer Off" (Top-Right)
- **Master switch** for the healing system
- Controls whether **automated triggers** are allowed
- Does NOT affect manual healing (always allowed)
- Think of it as: "Can the system heal automatically?"

### Toggle #2: "Auto Healer - Disabled" (Details Section)
- **Healing mode selector** (MANUAL, SEMI_AUTO, FULL_AUTO)
- Controls the **level of automation**
- Only matters if Toggle #1 is ON
- Think of it as: "How much automation do I want?"

### Relationship
```
Toggle #1 = Permission Gate (Can auto-heal?)
Toggle #2 = Automation Level (How much automation?)

Result = Toggle #1 AND Toggle #2
```

---

## 🚀 User Flow Examples

### Example 1: Enable Full Automation
1. Click "Healer Off" → Changes to "Healer On" (Toggle #1 = ON)
2. Click "Auto Healer - Disabled" → Select "Fully Automatic" (Toggle #2 = FULL_AUTO)
3. **Result**: System will automatically detect and heal issues

### Example 2: Enable Semi-Automation
1. Click "Healer Off" → Changes to "Healer On" (Toggle #1 = ON)
2. Click "Auto Healer - Disabled" → Select "Semi-Automatic" (Toggle #2 = SEMI_AUTO)
3. **Result**: System will detect issues and ask for approval before healing

### Example 3: Disable All Automation
1. Click "Healer On" → Changes to "Healer Off" (Toggle #1 = OFF)
2. Toggle #2 doesn't matter (automation is blocked)
3. **Result**: Only manual healing allowed

### Example 4: Manual Healing Only (Even with Toggle ON)
1. Toggle #1 = ON (or OFF, doesn't matter)
2. Toggle #2 = MANUAL
3. **Result**: Only manual healing allowed (no automation)

---

## ✅ Conclusion

**Toggle #1 (Top-Right "Healer Off")**: Master switch - enables/disables automated healing
**Toggle #2 (Details "Auto Healer")**: Automation level - controls how much automation

Both work together to provide flexible healing control:
- **Maximum Safety**: Both OFF or Toggle #2 = MANUAL
- **Balanced**: Toggle #1 ON + Toggle #2 = SEMI_AUTO
- **Maximum Automation**: Toggle #1 ON + Toggle #2 = FULL_AUTO

