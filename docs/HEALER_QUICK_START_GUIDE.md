# WordPress Auto-Healer Intelligence - Quick Start Guide

## Getting Started

This guide helps you implement the intelligence features step-by-step.

---

## Prerequisites

### Required
- Node.js 20+
- PostgreSQL 16
- Redis 7
- OpenAI API key (for AI features)

### Optional
- Docker & Docker Compose (for local development)

---

## Phase 1: Production Readiness (Start Here)

### Step 1: Database Migration

```bash
cd backend

# Create migration for new models
npx prisma migrate dev --name add_healer_intelligence

# Apply migration
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### Step 2: Environment Variables

Add to `backend/.env`:

```env
# OpenAI (for AI analysis - Phase 2)
OPENAI_API_KEY=sk-...

# Redis (for queue and caching)
REDIS_URL=redis://localhost:6379

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/opsmanager
```

### Step 3: Install Dependencies

```bash
cd backend
pnpm install

# No new dependencies needed for Phase 1
# Phase 2 will require: openai package
```

### Step 4: Implement Services (Week 1)

Create these files in order:

1. **VerificationService** (`backend/src/modules/healer/services/verification.service.ts`)
   - Copy implementation from main plan document
   - Test with: `pnpm test verification.service.spec.ts`

2. **Update HealingProcessor** to use verification
   - Add verification step after healing
   - Update execution with verification results

3. **Test verification**
   ```bash
   # Run unit tests
   pnpm test verification

   # Test manually via API
   curl -X POST http://localhost:3001/api/v1/healer/sites/{id}/diagnose
   curl -X POST http://localhost:3001/api/v1/healer/executions/{id}/heal
   # Check verification results in response
   ```

### Step 5: Implement Monitoring (Week 2)

1. **MetricsService** (`backend/src/modules/healer/services/metrics.service.ts`)
   - Implements automated metrics collection
   - Runs hourly and daily via cron

2. **Add API endpoints** to `healer.controller.ts`
   ```typescript
   @Get('metrics/:periodType')
   @Get('alerts')
   @Post('alerts/:id/acknowledge')
   ```

3. **Test metrics collection**
   ```bash
   # Trigger manual collection
   curl -X POST http://localhost:3001/api/v1/healer/metrics/collect

   # View metrics
   curl http://localhost:3001/api/v1/healer/metrics/HOURLY
   ```

### Step 6: Implement Retry Logic (Week 3)

1. **RetryService** (`backend/src/modules/healer/services/retry.service.ts`)
   - Implements 4 retry strategies
   - Enhanced circuit breaker

2. **Update HealingProcessor**
   - Add retry logic wrapper
   - Handle retry scheduling

3. **Test retry behavior**
   ```bash
   # Simulate failure to trigger retry
   # Check execution logs for retry attempts
   ```

### Step 7: Security Hardening (Week 3-4)

1. **SecurityService** (`backend/src/modules/healer/services/security.service.ts`)
   - Command validation
   - Audit logging

2. **Update all controllers** with audit logging
   - Add `@IpAddress()` and `@UserAgent()` decorators
   - Call `securityService.logAudit()` for all actions

3. **Test security**
   ```bash
   # Try dangerous command (should be blocked)
   curl -X POST http://localhost:3001/api/v1/healer/executions/{id}/heal \
     -d '{"customCommands": ["rm -rf /"]}'
   # Should return error: "Invalid commands"

   # View audit logs
   curl http://localhost:3001/api/v1/healer/audit-logs
   ```

### Step 8: Testing (Week 4)

1. **Write unit tests**
   ```bash
   # Create test files
   mkdir -p backend/src/modules/healer/__tests__/unit
   
   # Write tests for each service
   # Run tests
   pnpm test
   ```

2. **Write integration tests**
   ```bash
   mkdir -p backend/src/modules/healer/__tests__/integration
   
   # Test full flow
   pnpm test:e2e
   ```

3. **Check coverage**
   ```bash
   pnpm test:cov
   # Target: >85% coverage
   ```

---

## Phase 2: Intelligence Layer (Weeks 5-8)

### Step 1: OpenAI Setup

```bash
# Install OpenAI SDK
cd backend
pnpm add openai

# Set API key in .env
echo "OPENAI_API_KEY=sk-..." >> .env
```

### Step 2: Implement AI Analysis

1. **AiAnalysisService** (`backend/src/modules/healer/services/ai-analysis.service.ts`)
   - GPT-4 integration
   - Response caching

2. **Update DiagnosisService**
   - Add AI analysis after diagnosis
   - Enhance diagnosis with AI insights

3. **Test AI analysis**
   ```bash
   # Diagnose a site with errors
   curl -X POST http://localhost:3001/api/v1/healer/sites/{id}/diagnose
   
   # Check response for AI analysis
   # Should include: aiRootCause, aiConfidence, aiRecommendations
   ```

### Step 3: Predictive Maintenance

1. **PredictiveMaintenanceService**
   - Anomaly detection
   - Trend analysis

2. **Add cron job** for predictions
   ```typescript
   @Cron(CronExpression.EVERY_HOUR)
   async runPredictions() {
     // Analyze all sites for anomalies
   }
   ```

3. **Test predictions**
   ```bash
   curl http://localhost:3001/api/v1/healer/sites/{id}/predictions
   ```

---

## Phase 3: Advanced Features (Weeks 9-12)

### Step 1: Batch Operations

1. **BatchOperationsService**
   - Bulk diagnosis
   - Parallel execution

2. **Test batch operations**
   ```bash
   curl -X POST http://localhost:3001/api/v1/healer/batch/diagnose \
     -d '{"siteIds": ["id1", "id2", "id3"]}'
   ```

### Step 2: Integrations

1. **IntegrationService**
   - Webhook support
   - Slack/Discord notifications

2. **Configure webhooks**
   ```bash
   curl -X POST http://localhost:3001/api/v1/healer/integrations/webhooks \
     -d '{"url": "https://hooks.slack.com/...", "events": ["HEALING_SUCCESS"]}'
   ```

---

## Frontend Implementation

### Step 1: Create Components

```bash
cd frontend

# Create healer components directory
mkdir -p src/components/healer/intelligence
```

### Step 2: Implement UI Components

1. **VerificationResultsPanel.tsx**
   - Display verification checks
   - Show score and pass/fail status

2. **MetricsDashboard.tsx**
   - Charts for metrics
   - Alert display

3. **AiAnalysisPanel.tsx**
   - Show AI insights
   - Display recommendations

### Step 3: Update Existing Components

Update `SiteDetailView.tsx`:
- Add verification results display
- Add AI analysis panel
- Add metrics charts

---

## Testing Checklist

### Phase 1
- [ ] Verification returns score 0-100
- [ ] Metrics collected hourly
- [ ] Alerts created for failures
- [ ] Circuit breaker opens after 3 failures
- [ ] Retry logic works with exponential backoff
- [ ] Dangerous commands blocked
- [ ] Audit logs created for all actions
- [ ] Unit test coverage >85%

### Phase 2
- [ ] AI analysis returns insights
- [ ] AI cache working (check hit count)
- [ ] Predictions generated hourly
- [ ] Anomalies detected correctly
- [ ] Patterns learned from successes

### Phase 3
- [ ] Batch operations process multiple sites
- [ ] Webhooks fire on events
- [ ] Recommendations generated
- [ ] Integrations working

---

## Monitoring

### Key Metrics to Watch

1. **Healing Success Rate**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE status = 'SUCCESS') * 100.0 / COUNT(*) as success_rate
   FROM healer_executions
   WHERE created_at > NOW() - INTERVAL '24 hours';
   ```

2. **Average Verification Score**
   ```sql
   SELECT AVG(verification_score) as avg_score
   FROM healer_executions
   WHERE verification_score IS NOT NULL
   AND created_at > NOW() - INTERVAL '24 hours';
   ```

3. **AI Analysis Usage**
   ```sql
   SELECT 
     COUNT(*) as total_analyses,
     SUM(hit_count) as cache_hits
   FROM ai_analysis_cache;
   ```

4. **Active Alerts**
   ```sql
   SELECT severity, COUNT(*) as count
   FROM healer_alerts
   WHERE status = 'ACTIVE'
   GROUP BY severity;
   ```

---

## Troubleshooting

### Issue: Verification always fails

**Solution:**
- Check if site is actually accessible
- Verify HTTP status check is working
- Check error logs for WSOD indicators
- Ensure verification thresholds are reasonable (>80 = pass)

### Issue: AI analysis not working

**Solution:**
- Verify OPENAI_API_KEY is set
- Check OpenAI API quota/billing
- Review AI analysis cache for errors
- Check logs for API errors

### Issue: Circuit breaker opens too quickly

**Solution:**
- Increase `maxHealingAttempts` in site config
- Adjust circuit breaker reset time
- Review failure reasons in execution logs

### Issue: Metrics not collecting

**Solution:**
- Check cron job is running
- Verify database permissions
- Check for errors in metrics service logs
- Manually trigger collection to test

---

## Performance Optimization

### Database Indexes

Ensure these indexes exist:

```sql
CREATE INDEX idx_healer_executions_site_status ON healer_executions(site_id, status);
CREATE INDEX idx_healer_executions_created_at ON healer_executions(created_at DESC);
CREATE INDEX idx_healer_metrics_period ON healer_metrics(period_start, period_type);
CREATE INDEX idx_healer_alerts_status_severity ON healer_alerts(status, severity);
CREATE INDEX idx_ai_cache_input_hash ON ai_analysis_cache(input_hash);
```

### Redis Caching

Configure Redis for:
- AI analysis cache (30-day TTL)
- Metrics cache (1-hour TTL)
- Rate limiting

### Queue Optimization

```typescript
// Configure BullMQ for optimal performance
const queueOptions = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 500,     // Keep last 500 failed jobs
  },
};
```

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] OpenAI API key valid
- [ ] Redis connection working
- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] Backup strategy in place

### Deployment Steps

1. **Backup database**
   ```bash
   pg_dump opsmanager > backup_$(date +%Y%m%d).sql
   ```

2. **Run migrations**
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

3. **Deploy backend**
   ```bash
   pnpm build
   pm2 restart opsmanager-backend
   ```

4. **Deploy frontend**
   ```bash
   cd frontend
   pnpm build
   pm2 restart opsmanager-frontend
   ```

5. **Verify deployment**
   ```bash
   # Check health endpoint
   curl http://localhost:3001/health
   
   # Check metrics
   curl http://localhost:3001/api/v1/healer/metrics/HOURLY
   ```

### Post-Deployment Monitoring

Monitor for 24 hours:
- Error rates
- Response times
- Healing success rates
- AI analysis performance
- Alert frequency

---

## Support & Resources

### Documentation
- Full Implementation Plan: `docs/HEALER_INTELLIGENCE_IMPLEMENTATION_PLAN.md`
- Summary: `docs/HEALER_IMPLEMENTATION_SUMMARY.md`
- This Guide: `docs/HEALER_QUICK_START_GUIDE.md`

### Code Examples
- All service implementations in main plan document
- Test examples included
- API endpoint examples provided

### Getting Help
- Review logs: `backend/logs/`
- Check database: Query `healer_audit_logs` for actions
- Monitor queue: BullMQ dashboard
- AI analysis: Check `ai_analysis_cache` for cached responses

---

## Next Steps

1. **Start with Phase 1** - Production readiness is critical
2. **Test thoroughly** - Don't skip testing
3. **Monitor closely** - Watch metrics after each phase
4. **Iterate** - Gather feedback and improve
5. **Document** - Keep implementation notes

Good luck with your implementation! 🚀
