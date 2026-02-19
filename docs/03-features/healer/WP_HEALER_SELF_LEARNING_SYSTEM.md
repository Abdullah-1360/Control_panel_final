# WordPress Healer Self-Learning Automation System

## Overview

The WordPress Healer now includes a self-learning automation system that learns from manual healing executions and gradually automates common scenarios based on confidence and success rates.

## How It Works

### 1. Learning Workflow

```
Manual Diagnosis → User Approves Fix → Healing Executes → System Learns Pattern
                                                              ↓
                                                    Pattern Confidence Increases
                                                              ↓
                                                    Auto-Approval at 90%+ confidence
```

### 2. Pattern Recognition

The system creates a "fingerprint" for each healing scenario:
- **Diagnosis Type**: WSOD, MAINTENANCE, DB_ERROR, etc.
- **Error Type**: Specific error category
- **Culprit**: Plugin/theme causing the issue
- **Error Pattern**: Regex pattern extracted from error message
- **Commands**: The healing commands that were executed

### 3. Confidence Building

**Pattern Confidence Formula:**
```
confidence = successCount / (successCount + failureCount)
```

**Auto-Approval Criteria:**
- Confidence > 90%
- At least 5 successful executions
- No recent failures

### 4. Learning Stages

#### Stage 1: New Pattern (0-2 successes)
- **Status**: "New Scenario Detected"
- **Behavior**: Always requires manual approval
- **UI**: Shows amber alert "This is a new issue pattern"

#### Stage 2: Learning (3-4 successes)
- **Status**: "Learning Mode"
- **Behavior**: Still requires manual approval
- **UI**: Shows blue alert with success rate
- **Message**: "X more successes needed for auto-approval"

#### Stage 3: Auto-Approved (5+ successes, 90%+ confidence)
- **Status**: "Auto-Approved Pattern"
- **Behavior**: Can execute automatically (if enabled)
- **UI**: Shows green alert "Auto-approved: 95% success rate"
- **Message**: "This solution has worked X/Y times"

## Implementation Details

### Backend Components

#### 1. PatternLearningService
**Location**: `backend/src/modules/healer/services/pattern-learning.service.ts`

**Key Methods:**
- `learnFromExecution(executionId)` - Called after successful healing
- `recordFailure(executionId)` - Called after failed healing
- `suggestCommands(diagnosis)` - Returns pattern suggestions for diagnosis
- `getAllPatterns()` - List all learned patterns (admin)
- `deletePattern(patternId)` - Remove a pattern (admin)
- `setPatternApproval(patternId, approved)` - Manual approval override (admin)

#### 2. HealingProcessor
**Location**: `backend/src/modules/healer/processors/healing.processor.ts`

**Integration Points:**
```typescript
// After successful healing (line ~147)
await this.patternLearning.learnFromExecution(executionId);

// After failed healing (line ~167)
await this.patternLearning.recordFailure(executionId);
```

#### 3. HealingOrchestratorService
**Location**: `backend/src/modules/healer/services/healing-orchestrator.service.ts`

**Pattern Suggestion Flow:**
```typescript
// During diagnosis
const patternSuggestions = await this.patternLearning.suggestCommands(diagnosis);

// Use best pattern if available
if (patternSuggestions.length > 0) {
  const bestPattern = patternSuggestions[0];
  suggestedCommands = bestPattern.commands;
  suggestedAction = bestPattern.reasoning;
}
```

#### 4. API Endpoints
**Location**: `backend/src/modules/healer/healer.controller.ts`

**New Endpoints:**
- `GET /api/v1/healer/patterns` - List all patterns
- `DELETE /api/v1/healer/patterns/:id` - Delete pattern
- `PATCH /api/v1/healer/patterns/:id/approval` - Toggle auto-approval

### Frontend Components

#### 1. DiagnosisPanel (Enhanced)
**Location**: `frontend/src/components/healer/DiagnosisPanel.tsx`

**New Features:**
- Shows pattern learning status with colored alerts
- Displays confidence score with color coding:
  - Green (>90%): Auto-approved
  - Blue (70-90%): Learning
  - Default (<70%): New pattern
- Shows reasoning text from pattern learning
- Button text changes based on auto-approval status

**UI States:**
```typescript
// New scenario
<Alert className="border-amber-200 bg-amber-50">
  "New Scenario Detected - System will learn from your approval"
</Alert>

// Learning mode
<Alert className="border-blue-200 bg-blue-50">
  "Learning: This solution has worked 3/4 times. 2 more successes needed"
</Alert>

// Auto-approved
<Alert className="border-blue-200 bg-blue-50">
  "Auto-approved: This solution has worked 8/9 times (89% success rate)"
</Alert>
```

#### 2. PatternsPage (New)
**Location**: `frontend/src/components/healer/PatternsPage.tsx`

**Features:**
- View all learned patterns in a table
- See success rate, confidence, and status for each pattern
- Manually approve/disapprove patterns
- Delete patterns
- Real-time updates (10-second polling)

**Access**: `/healer/patterns`

### Database Schema

#### HealingPattern Model
**Location**: `backend/prisma/schema.prisma`

```prisma
model HealingPattern {
  id            String        @id @default(cuid())
  diagnosisType DiagnosisType
  errorType     String?
  culprit       String?
  errorPattern  String?       // Regex pattern
  commands      String[]      // Commands to execute
  description   String
  successCount  Int           @default(0)
  failureCount  Int           @default(0)
  confidence    Float         @default(0.0)
  autoApproved  Boolean       @default(false)
  lastUsedAt    DateTime?
  lastSuccessAt DateTime?
  lastFailureAt DateTime?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}
```

## Usage Examples

### Example 1: First Time Seeing WSOD from Plugin X

**Diagnosis:**
```json
{
  "diagnosisType": "WSOD",
  "errorType": "FATAL_ERROR",
  "culprit": "plugin-x/plugin-x.php",
  "errorMessage": "Fatal error in /home/user/public_html/wp-content/plugins/plugin-x/plugin-x.php on line 42"
}
```

**User Experience:**
1. Diagnosis shows: "New Scenario Detected"
2. User clicks "Approve & Execute Fix"
3. System creates new pattern with 0 successes
4. Healing executes
5. On success: Pattern updated to 1 success, 100% confidence
6. Next time: Shows "Learning: 1/1 times. 4 more successes needed"

### Example 2: Fifth Success with Same Pattern

**User Experience:**
1. Diagnosis shows: "Auto-Approved Pattern"
2. Shows: "This solution has worked 5/5 times (100% success rate)"
3. Button text: "Execute Auto-Approved Fix"
4. Pattern is now eligible for automatic execution

### Example 3: Pattern with Failures

**Scenario:**
- 7 successes, 2 failures
- Confidence: 77.8%

**User Experience:**
1. Shows: "Learning: This solution has worked 7/9 times (78% success rate)"
2. Still requires manual approval (below 90% threshold)
3. Shows: "Need 90%+ confidence for auto-approval"

## Configuration

### Auto-Approval Thresholds

**Current Settings** (in `PatternLearningService`):
```typescript
const autoApproved = confidence > 0.9 && successCount >= 5;
```

**To Adjust:**
1. Edit `backend/src/modules/healer/services/pattern-learning.service.ts`
2. Modify the `updatePatternSuccess()` method
3. Change thresholds as needed:
   - `confidence > 0.9` → Minimum confidence (90%)
   - `successCount >= 5` → Minimum successes (5)

### Pattern Matching

**Fingerprint Components:**
- Exact match: `diagnosisType`, `errorType`, `culprit`, `commands`
- Regex match: `errorPattern` (extracted from error message)

**Match Scoring:**
```typescript
// Exact culprit match: 1.0
// Different culprit: 0.5
// Error pattern match: 1.2x multiplier
// No error pattern match: 0.7x multiplier
```

## Admin Management

### Viewing Patterns

**URL**: `http://localhost:3000/healer/patterns`

**Features:**
- See all learned patterns
- View success rates and confidence
- See when patterns were last used
- Filter by status (New, Learning, Auto-Approved)

### Manual Approval Override

**Use Case**: Force approve a pattern before it reaches 90% confidence

**Steps:**
1. Go to `/healer/patterns`
2. Find the pattern
3. Click the checkmark icon
4. Pattern is now auto-approved

### Deleting Patterns

**Use Case**: Remove incorrect or outdated patterns

**Steps:**
1. Go to `/healer/patterns`
2. Find the pattern
3. Click the trash icon
4. Confirm deletion

**Note**: System will relearn the pattern if the scenario occurs again

## Testing the System

### Test Scenario 1: New Pattern Learning

1. Discover a site with an issue
2. Run diagnosis
3. Verify "New Scenario Detected" alert appears
4. Click "Approve & Execute Fix"
5. Wait for healing to complete
6. Run diagnosis again on similar issue
7. Verify "Learning: 1/1 times" appears

### Test Scenario 2: Auto-Approval

1. Create a test pattern with 5+ successes and 90%+ confidence
2. Run diagnosis on matching scenario
3. Verify "Auto-Approved Pattern" alert appears
4. Verify button text is "Execute Auto-Approved Fix"

### Test Scenario 3: Pattern Management

1. Go to `/healer/patterns`
2. Verify patterns are listed
3. Toggle approval on a pattern
4. Delete a pattern
5. Verify changes are reflected

## Monitoring

### Pattern Learning Logs

**Backend logs show:**
```
[PatternLearningService] Learned from execution abc123, pattern xyz789 now has 3 successes
[PatternLearningService] Recorded failure for pattern xyz789
[HealingOrchestratorService] Using learned pattern xyz789 with 85% confidence
```

### Database Queries

**Check pattern statistics:**
```sql
SELECT 
  diagnosisType,
  COUNT(*) as pattern_count,
  AVG(confidence) as avg_confidence,
  SUM(successCount) as total_successes,
  SUM(failureCount) as total_failures
FROM "HealingPattern"
GROUP BY diagnosisType;
```

**Find auto-approved patterns:**
```sql
SELECT * FROM "HealingPattern"
WHERE autoApproved = true
ORDER BY confidence DESC;
```

## Future Enhancements

### Phase 2: Automatic Execution
- Add site-level setting: `autoHealingEnabled`
- When enabled + pattern is auto-approved → Execute without user approval
- Add safety checks: max auto-executions per day, circuit breaker

### Phase 3: Pattern Sharing
- Export patterns to JSON
- Import patterns from other installations
- Community pattern library

### Phase 4: Advanced Learning
- Machine learning for pattern matching
- Anomaly detection for new error types
- Predictive healing (before site goes down)

## Troubleshooting

### Pattern Not Learning

**Symptoms**: Executions complete but pattern count doesn't increase

**Checks:**
1. Verify `PatternLearningService` is in `HealerModule` providers
2. Check backend logs for learning errors
3. Verify execution status is `SUCCESS` (not `FAILED`)
4. Check database: `SELECT * FROM "HealingPattern"`

### Pattern Not Suggesting

**Symptoms**: Diagnosis doesn't show pattern suggestions

**Checks:**
1. Verify pattern exists: `SELECT * FROM "HealingPattern" WHERE diagnosisType = 'WSOD'`
2. Check pattern matching logic in `findMatchingPatterns()`
3. Verify `diagnosisDetails.patternSuggestions` is populated
4. Check frontend console for parsing errors

### Auto-Approval Not Working

**Symptoms**: Pattern has 90%+ confidence but not auto-approved

**Checks:**
1. Verify `successCount >= 5`
2. Check `autoApproved` field in database
3. Verify no recent failures (confidence recalculated on each update)
4. Check `updatePatternSuccess()` logic

## Summary

The self-learning automation system provides:

✅ **Gradual Automation**: Starts manual, becomes automatic with confidence
✅ **Transparency**: Shows learning progress and reasoning
✅ **Safety**: Requires 90%+ confidence and 5+ successes
✅ **Control**: Admin can override approval or delete patterns
✅ **Monitoring**: Full visibility into pattern library and statistics

The system learns from every healing execution, building confidence over time and reducing manual intervention for common scenarios.
