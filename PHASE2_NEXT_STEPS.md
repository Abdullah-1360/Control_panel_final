# Phase 2: Intelligence Layer - Implementation Guide

## Status: Ready to Start

Phase 1 (Production Readiness) is complete. All TypeScript errors are resolved, and the system is ready for Phase 2 implementation.

---

## Phase 2 Overview

**Goal**: Add AI-powered intelligence for root cause analysis and predictive maintenance

**Duration**: 4 weeks

**Priority**: P1 (Should-Have)

**Key Features**:
1. AI-Powered Root Cause Analysis (OpenAI GPT-4)
2. Predictive Maintenance
3. Performance Baselines
4. Enhanced Pattern Learning

---

## 2.1 AI-Powered Root Cause Analysis

### Prerequisites

1. **OpenAI API Key**: Sign up at https://platform.openai.com/
2. **Add to .env**:
   ```
   OPENAI_API_KEY=sk-...your-key-here...
   ```

### Database Schema (Already in schema.prisma)

The following fields are already added to HealerExecution:
- `aiAnalysis` (JSON with AI insights)
- `aiConfidence` (0.0-1.0)
- `aiRecommendations` (JSON array)
- `aiReasoning` (explanation)
- `aiModel` (e.g., "gpt-4")
- `aiTokensUsed` (token count)

### New Model Needed: AiAnalysisCache

Add to `backend/prisma/schema.prisma`:

```prisma
model AiAnalysisCache {
  id              String   @id @default(uuid())
  
  // Input hash (for deduplication)
  inputHash       String   @unique
  
  // Input data
  diagnosisType   DiagnosisType
  errorSignature  String   @db.Text
  logSample       String   @db.Text
  
  // AI response
  analysis        String   @db.Text // JSON
  confidence      Float
  recommendations String   @db.Text // JSON array
  reasoning       String   @db.Text
  
  // Metadata
  model           String
  tokensUsed      Int
  responseTime    Int      // milliseconds
  
  // Usage tracking
  hitCount        Int      @default(1)
  lastUsedAt      DateTime @default(now())
  
  createdAt       DateTime @default(now())
  expiresAt       DateTime // Cache for 30 days
  
  @@index([inputHash])
  @@index([diagnosisType])
  @@index([expiresAt])
  @@map("ai_analysis_cache")
}
```

### Implementation Steps

1. **Create Migration**:
   ```bash
   cd backend
   npx prisma migrate dev --name add_ai_analysis_cache
   ```

2. **Create AiAnalysisService**:
   - File: `backend/src/modules/healer/services/ai-analysis.service.ts`
   - Features:
     - Call OpenAI GPT-4 API
     - Cache results (30-day TTL)
     - Parse AI responses
     - Handle errors gracefully
   - See full implementation in `docs/HEALER_INTELLIGENCE_IMPLEMENTATION_PLAN.md` (lines 2024-2646)

3. **Update DiagnosisService**:
   - Inject AiAnalysisService
   - Call AI analysis after diagnosis
   - Enhance diagnosis with AI insights
   - Use AI suggested commands if confidence > 0.8

4. **Add to HealerModule**:
   ```typescript
   providers: [
     // ... existing providers
     AiAnalysisService,
   ]
   ```

5. **Update HealingProcessor**:
   - Store AI analysis results in execution
   - Log AI insights to execution logs

6. **Add Cron Job for Cache Cleanup**:
   ```typescript
   @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
   async cleanAiCache() {
     await this.aiAnalysisService.cleanExpiredCache();
   }
   ```

### API Endpoints (Optional)

Add to HealerController:

```typescript
/**
 * POST /api/v1/healer/executions/:id/ai-analyze
 * Trigger AI analysis for an execution
 */
@Post('executions/:id/ai-analyze')
async triggerAiAnalysis(@Param('id') executionId: string) {
  const result = await this.aiAnalysisService.analyzeExecution(executionId);
  return { data: result };
}

/**
 * GET /api/v1/healer/ai-cache/stats
 * Get AI cache statistics
 */
@Get('ai-cache/stats')
async getAiCacheStats() {
  const stats = await this.aiAnalysisService.getCacheStats();
  return { data: stats };
}
```

### Testing

1. **Unit Tests**:
   - Test AI response parsing
   - Test cache hit/miss logic
   - Test error handling

2. **Integration Tests**:
   - Test full diagnosis with AI analysis
   - Test cache behavior
   - Test OpenAI API integration (with mocks)

3. **Manual Testing**:
   - Diagnose a site with WSOD
   - Verify AI analysis appears in execution
   - Check AI suggested commands
   - Verify cache is working

### Cost Considerations

- **GPT-4 Turbo**: ~$0.01 per 1K input tokens, ~$0.03 per 1K output tokens
- **Average diagnosis**: ~500 input tokens, ~300 output tokens = ~$0.015 per diagnosis
- **Cache hit rate**: Expect 60-80% cache hits after initial period
- **Monthly cost** (1000 diagnoses, 30% cache miss): ~$4.50/month

---

## 2.2 Predictive Maintenance

### Goal
Detect anomalies and predict issues before they occur.

### Features
- Baseline performance tracking
- Anomaly detection (response time, error rate)
- Predictive alerts
- Trend analysis

### Implementation
- Create `PredictiveMaintenanceService`
- Track metrics over time
- Use statistical methods for anomaly detection
- Create alerts for predicted issues

### Database Schema
```prisma
model PerformanceBaseline {
  id              String   @id @default(uuid())
  siteId          String
  site            WpSite   @relation(fields: [siteId], references: [id])
  
  // Baseline metrics
  avgResponseTime Int      // milliseconds
  avgPageSize     Int      // bytes
  avgErrorRate    Float    // 0.0-1.0
  
  // Calculated from
  sampleSize      Int
  periodStart     DateTime
  periodEnd       DateTime
  
  createdAt       DateTime @default(now())
  
  @@index([siteId])
  @@map("performance_baselines")
}

model PredictiveAlert {
  id              String   @id @default(uuid())
  siteId          String
  
  alertType       String   // PERFORMANCE_DEGRADATION, ERROR_SPIKE, etc.
  severity        String   // LOW, MEDIUM, HIGH
  prediction      String   @db.Text // What we predict will happen
  confidence      Float    // 0.0-1.0
  
  // Evidence
  currentMetrics  String   @db.Text // JSON
  baselineMetrics String   @db.Text // JSON
  deviation       Float    // How far from baseline
  
  createdAt       DateTime @default(now())
  
  @@index([siteId])
  @@map("predictive_alerts")
}
```

---

## 2.3 Performance Baselines

### Goal
Establish normal performance baselines for each site.

### Features
- Track response time, page size, error rate
- Calculate baselines from historical data
- Detect deviations from baseline
- Alert on significant changes

### Implementation
- Create `BaselineService`
- Calculate baselines weekly
- Store in PerformanceBaseline model
- Use in anomaly detection

---

## 2.4 Enhanced Pattern Learning

### Goal
Improve pattern learning with AI insights and auto-approval.

### Features
- AI-enhanced pattern matching
- Auto-approval for high-confidence patterns
- Pattern versioning
- Pattern effectiveness tracking

### Database Schema Updates
```prisma
model HealingPattern {
  // ... existing fields ...
  
  // Enhanced fields
  version         Int      @default(1)
  aiEnhanced      Boolean  @default(false)
  aiConfidence    Float?
  autoApproved    Boolean  @default(false)
  approvedBy      String?
  approvedAt      DateTime?
  
  // Effectiveness tracking
  lastUsedAt      DateTime?
  avgSuccessRate  Float?   // Rolling average
  recentSuccesses Int      @default(0)
  recentFailures  Int      @default(0)
}
```

---

## Implementation Priority

### Week 1-2: AI Root Cause Analysis
- [ ] Add AiAnalysisCache model
- [ ] Create migration
- [ ] Implement AiAnalysisService
- [ ] Update DiagnosisService
- [ ] Add to HealerModule
- [ ] Write tests
- [ ] Test with real sites

### Week 3: Predictive Maintenance
- [ ] Add PerformanceBaseline model
- [ ] Add PredictiveAlert model
- [ ] Create migration
- [ ] Implement PredictiveMaintenanceService
- [ ] Add cron jobs for baseline calculation
- [ ] Write tests

### Week 4: Enhanced Pattern Learning
- [ ] Update HealingPattern model
- [ ] Create migration
- [ ] Enhance PatternLearningService
- [ ] Add auto-approval logic
- [ ] Add pattern versioning
- [ ] Write tests

---

## Success Metrics

### Phase 2 Targets
- AI analysis accuracy: >90%
- Cache hit rate: >70%
- Predictive alert accuracy: >80%
- Pattern auto-approval rate: >60%
- AI cost per diagnosis: <$0.02

---

## Next Steps

1. **Get OpenAI API Key**: Sign up and add to .env
2. **Add AiAnalysisCache model**: Update schema.prisma
3. **Create migration**: `npx prisma migrate dev`
4. **Implement AiAnalysisService**: Copy from implementation plan
5. **Update DiagnosisService**: Add AI analysis integration
6. **Test**: Write unit tests and test with real sites

---

**Ready to Start**: All Phase 1 dependencies are complete. Phase 2 can begin immediately.

**Estimated Completion**: 4 weeks from start date

**Blockers**: None (OpenAI API key is the only external dependency)
