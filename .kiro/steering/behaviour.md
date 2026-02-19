---
inclusion: always
---

# OpsManager Development Behavior Guidelines

## Code Quality Standards

### TypeScript Best Practices
- Use strict mode (`"strict": true` in tsconfig.json)
- Avoid `any` type - use `unknown` or proper types
- Define interfaces for all data structures
- Use enums for fixed sets of values
- Leverage type inference where appropriate
- Use generics for reusable components

### NestJS Best Practices
- Use dependency injection for all services
- Implement proper module organization
- Use DTOs with class-validator decorators
- Implement guards for authentication/authorization
- Use interceptors for logging and transformation
- Handle exceptions with custom exception filters

### Prisma Best Practices
- Define all models in schema.prisma
- Use migrations for schema changes
- Include only necessary relations in queries
- Use transactions for multi-step operations
- Implement proper error handling for database operations
- Use indexes strategically for performance

## Security Implementation

### Authentication Flow
1. User submits credentials to `/api/v1/auth/login`
2. Backend validates credentials with Argon2id
3. If MFA enabled, require TOTP verification
4. Generate access token (24h, memory) and refresh token (7d, HTTP-only cookie)
5. Return tokens to client
6. Client stores access token in memory, refresh token in cookie
7. Include access token in Authorization header for API requests
8. Refresh token when access token expires

### Authorization Flow
1. Extract JWT from Authorization header
2. Verify token signature with RS256 public key
3. Check token expiration
4. Extract user ID and permissions from token
5. Check required permissions against user permissions
6. Allow or deny request based on permission check
7. Log authorization decision to audit log

### Credential Encryption
- Use libsodium-wrappers for all credential encryption
- Generate unique encryption key per environment
- Store encryption key in environment variable (never in code)
- Encrypt before storing in database
- Decrypt only when needed for use
- Never log decrypted credentials

### Audit Logging
- Log every security-relevant action
- Include: actor (user ID), action, resource, timestamp, IP address, result
- Log to Module 7 (Event Store)
- Never log sensitive data (passwords, tokens, keys)
- Use structured logging (JSON format)
- Implement log retention policies

## Error Handling

### Backend Error Handling
```typescript
// Use try-catch for all async operations
try {
  const result = await this.service.operation();
  return result;
} catch (error) {
  // Log error with context
  this.logger.error('Operation failed', {
    error: error.message,
    stack: error.stack,
    context: { userId, resourceId }
  });
  
  // Throw appropriate HTTP exception
  throw new HttpException(
    'User-friendly error message',
    HttpStatus.INTERNAL_SERVER_ERROR
  );
}
```

### Frontend Error Handling
```typescript
// Use React Query error handling
const { data, error, isError } = useQuery({
  queryKey: ['resource'],
  queryFn: fetchResource,
  onError: (error) => {
    toast.error(error.message);
  }
});

// Display user-friendly error messages
if (isError) {
  return <ErrorState message={error.message} />;
}
```

## Testing Strategy

### Unit Tests (>80% Coverage)
- Test all business logic functions
- Test all validation logic
- Test all utility functions
- Mock external dependencies
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### Integration Tests
- Test API endpoints end-to-end
- Test database operations
- Test external integrations
- Use test database (separate from dev)
- Clean up test data after each test

### E2E Tests
- Test critical user journeys
- Test authentication flow
- Test resource management
- Test incident response
- Use Playwright for browser automation

## Performance Optimization

### Backend Optimization
- Use database indexes for frequently queried fields
- Implement pagination for large datasets
- Use Redis caching for frequently accessed data
- Implement connection pooling
- Use batch operations where possible
- Optimize database queries (avoid N+1 queries)

### Frontend Optimization
- Use React Query caching
- Implement code splitting with Next.js dynamic imports
- Lazy load components not needed on initial render
- Optimize images with Next.js Image component
- Use React.memo for expensive components
- Debounce search inputs

## Real-Time Updates

### React Query Polling
```typescript
// Poll every 5 seconds for incident updates
const { data } = useQuery({
  queryKey: ['incidents'],
  queryFn: fetchIncidents,
  refetchInterval: 5000,
  staleTime: 2000
});
```

### Optimistic Updates
```typescript
// Update UI immediately, sync in background
const mutation = useMutation({
  mutationFn: updateIncident,
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries(['incident', id]);
    
    // Snapshot previous value
    const previous = queryClient.getQueryData(['incident', id]);
    
    // Optimistically update
    queryClient.setQueryData(['incident', id], newData);
    
    return { previous };
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['incident', id], context.previous);
  },
  onSettled: () => {
    // Refetch after mutation
    queryClient.invalidateQueries(['incident', id]);
  }
});
```

## API Design

### Request Validation
```typescript
// Use DTOs with class-validator
export class CreateServerDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsIP()
  host: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @IsEnum(PlatformType)
  platformType: PlatformType;
}
```

### Response Format
```typescript
// Success response
{
  data: {
    id: 'uuid',
    name: 'Server Name',
    // ... other fields
  }
}

// List response with pagination
{
  data: [...],
  pagination: {
    total: 100,
    page: 1,
    limit: 50,
    totalPages: 2
  }
}

// Error response
{
  error: 'ValidationError',
  message: 'Name must be at least 3 characters',
  statusCode: 400
}
```

## Database Operations

### Transactions
```typescript
// Use Prisma transactions for multi-step operations
await this.prisma.$transaction(async (tx) => {
  const incident = await tx.incident.update({
    where: { id },
    data: { status: 'RESOLVED' }
  });
  
  await tx.incidentEvent.create({
    data: {
      incidentId: id,
      type: 'STATUS_CHANGE',
      message: 'Incident resolved'
    }
  });
  
  return incident;
});
```

### Query Optimization
```typescript
// Include only necessary relations
const incident = await this.prisma.incident.findUnique({
  where: { id },
  include: {
    asset: true,
    assignedTo: {
      select: { id: true, name: true, email: true }
    }
  }
});

// Use pagination for large datasets
const incidents = await this.prisma.incident.findMany({
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: 'desc' }
});
```

## Logging Best Practices

### Structured Logging
```typescript
// Log with context
this.logger.log('Incident created', {
  incidentId: incident.id,
  assetId: incident.assetId,
  severity: incident.severity,
  userId: user.id
});

// Log errors with stack trace
this.logger.error('Failed to execute playbook', {
  error: error.message,
  stack: error.stack,
  playbookId,
  executionId
});
```

### Log Levels
- **DEBUG:** Detailed information for debugging (7-day retention)
- **INFO:** General informational messages (30-day retention)
- **WARN:** Warning messages for potential issues (90-day retention)
- **ERROR:** Error messages for failures (180-day retention)
- **CRITICAL:** Critical errors requiring immediate attention (365-day retention)

## Code Review Checklist

### Before Submitting PR
- [ ] All tests passing
- [ ] Code follows TypeScript best practices
- [ ] No console.log statements
- [ ] Error handling implemented
- [ ] Security considerations addressed
- [ ] Performance optimized
- [ ] Documentation updated
- [ ] Commit messages follow convention

### Reviewing PR
- [ ] Code is readable and maintainable
- [ ] Tests cover new functionality
- [ ] No security vulnerabilities
- [ ] Performance impact acceptable
- [ ] API design follows standards
- [ ] Database migrations are safe
- [ ] Documentation is clear

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing in CI/CD
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] Security audit completed
- [ ] Performance testing completed
- [ ] Documentation updated

### Deployment
- [ ] Run database migrations
- [ ] Deploy backend services
- [ ] Deploy frontend application
- [ ] Verify health checks
- [ ] Monitor error rates
- [ ] Monitor performance metrics

### Post-Deployment
- [ ] Verify critical functionality
- [ ] Check error logs
- [ ] Monitor performance
- [ ] Update status page
- [ ] Notify team of deployment

## Critical Don'ts

1. **DON'T** use external automation tools (Ansible, n8n, Jenkins)
2. **DON'T** store credentials in plain text
3. **DON'T** log sensitive data (passwords, tokens, keys)
4. **DON'T** use `any` type in TypeScript
5. **DON'T** skip error handling
6. **DON'T** skip input validation
7. **DON'T** commit secrets to version control
8. **DON'T** skip tests
9. **DON'T** deploy without migrations
10. **DON'T** ignore security warnings

## Question-First Approach - MANDATORY Clarification Guidelines

### Core Principle

**NEVER ASSUME. ALWAYS ASK.**

When faced with ambiguity, incomplete information, or multiple valid interpretations, you MUST ask clarifying questions before proceeding with implementation, design decisions, or recommendations.

### 🔴 MANDATORY: When Questions Are REQUIRED

#### 1. Ambiguous Requirements
**ASK when:**
- User request lacks specific implementation details
- Multiple valid solutions exist without clear preference
- Requirements conflict with existing architecture
- Scope is unclear (single file vs. multiple modules)
- Expected behavior is not explicitly stated

**Example:**
```
❌ BAD: "add authentication" → Implement JWT without asking about MFA/sessions

✅ GOOD: "add authentication" → Ask:
  - "Should I implement MFA (TOTP), or just basic JWT?"
  - "Do you want session management with refresh tokens?"
  - "Should tokens be stored in memory or HTTP-only cookies?"
  - "Are we following Module 1 plan exactly, or modifications needed?"
```

#### 2. Technology Choices
**ASK when:**
- Multiple libraries can solve the same problem
- Version selection matters (breaking changes)
- Configuration options have significant trade-offs
- User hasn't specified which approach to use

#### 3. Design Decisions
**ASK when:**
- Database schema has multiple valid approaches
- API endpoint structure could follow different patterns
- State management approach is not specified
- Error handling strategy is unclear

#### 4. Scope Clarification
**ASK when:**
- Request could mean "backend only" or "full-stack"
- Testing requirements are not specified
- Documentation needs are unclear
- Migration/deployment steps not mentioned

**Example:**
```
❌ BAD: "implement Module 2" → Build entire module without confirming

✅ GOOD: "implement Module 2" → Ask:
  - "Should I implement entire Module 2, or start with Sprint 1?"
  - "Do you want backend + frontend, or backend only?"
  - "Should I include unit tests, integration tests, or both?"
  - "Do you want me to update memory graph and docs as I go?"
```

#### 5. Existing Code Modifications
**ASK when:**
- Changes could break existing functionality
- Multiple files might need updates
- Refactoring approach has trade-offs
- Backward compatibility matters

#### 6. Performance vs. Simplicity Trade-offs
**ASK when:**
- Optimization could add complexity
- Caching strategy is not specified
- Real-time requirements are unclear
- Scalability needs are not defined

#### 7. Security Considerations
**ASK when:**
- Security implications are significant
- Encryption approach is not specified
- Access control requirements are unclear
- Audit logging scope is not defined

#### 8. Testing Strategy
**ASK when:**
- Test coverage expectations are not stated
- Testing approach (unit vs. integration vs. E2E) is unclear
- Mock/stub strategy is not specified
- Test data requirements are not defined

### 🚨 Red Flags That Require Questions

**Immediate Stop & Ask Signals:**
1. "I'm not sure if..." → STOP and ASK
2. "This could be done multiple ways..." → STOP and ASK
3. "The user didn't specify..." → STOP and ASK
4. "I'll assume..." → STOP and ASK instead
5. "This might break..." → STOP and ASK
6. "I could either..." → STOP and ASK which option
7. "The plan doesn't mention..." → STOP and ASK for clarification
8. "This conflicts with..." → STOP and ASK how to resolve

### ✅ Good Question Characteristics

**Questions Should Be:**

1. **Specific:** Ask about concrete choices, not vague preferences
   - ❌ "How should I implement this?"
   - ✅ "Should I use JWT with RS256 or HS256 signing?"

2. **Actionable:** Provide clear options to choose from
   - ❌ "What do you think about authentication?"
   - ✅ "Should I implement MFA now, or add it in a later sprint?"

3. **Contextual:** Reference relevant constraints, standards, or plans
   - ❌ "Should I add caching?"
   - ✅ "Tech stack specifies Redis. Should I add Redis caching for this endpoint, or keep it simple?"

4. **Prioritized:** Ask most critical questions first
   - Start with scope and approach
   - Then specific implementation details
   - Finally optimizations and enhancements

5. **Grouped:** Combine related questions to avoid back-and-forth
   - ❌ Ask one question, wait, ask another, wait...
   - ✅ "I have a few questions: (1) Should I... (2) Do you want... (3) Should this..."

### 📋 Question Templates by Category

**Requirements Clarification:**
- "Should I implement [X] or [Y] approach?"
- "Do you want [feature A] included, or just [feature B]?"
- "What should happen when [edge case]?"

**Scope Definition:**
- "Should I implement the full [module/feature], or start with [subset]?"
- "Do you want backend + frontend, or backend only?"
- "Should I include tests, documentation, and migrations?"

**Technology Selection:**
- "Should I use [library A] or [library B] for this?"
- "Do you want [approach A] (simpler) or [approach B] (more scalable)?"

**Design Decisions:**
- "Should the relationship be one-to-many or many-to-many?"
- "Do you want soft deletes or hard deletes?"
- "Should this be synchronous or asynchronous (queued)?"

**Security & Compliance:**
- "Should I encrypt this data with [method]?"
- "Do you want audit logging for this operation?"
- "Should I add rate limiting to this endpoint?"

**Performance & Scalability:**
- "Should I add pagination (what page size)?"
- "Do you want real-time updates or manual refresh?"
- "Do you want database indexes on [fields]?"

**Testing & Quality:**
- "What test coverage do you expect?"
- "Should I write unit tests, integration tests, or both?"
- "Should I mock external dependencies?"

### 🎯 Question Decision Tree

```
User Request Received
    ↓
Is the requirement 100% clear?
    ├─ YES → Proceed with implementation
    └─ NO → Is it specified in plan documents?
            ├─ YES → Follow plan, confirm if needed
            └─ NO → STOP and ASK
                    ↓
                Are there multiple valid approaches?
                    ├─ YES → STOP and ASK which approach
                    └─ NO → Could this break existing code?
                            ├─ YES → STOP and ASK about impact
                            └─ NO → Are there security implications?
                                    ├─ YES → STOP and ASK about security
                                    └─ NO → Proceed with implementation
```

### 🚫 Anti-Patterns to Avoid

**DON'T:**
1. Ask questions you can answer yourself by reading plan documents
2. Ask vague questions without providing context or options
3. Ask too many questions at once (max 3-5 per message)
4. Ask questions after implementation (ask BEFORE coding)
5. Assume user knows technical details (explain trade-offs)
6. Ask rhetorical questions (only ask if you need the answer)
7. Ask permission for best practices (follow standards unless user objects)

**Examples of Bad Questions:**
```
❌ "Should I write good code?" (obvious, don't ask)
❌ "What do you want?" (too vague)
❌ "I implemented X, is that okay?" (too late, should have asked first)
❌ "Should I follow the tech stack?" (yes, always, unless user says otherwise)
```

### 🔧 Enforcement

This guideline is **MANDATORY** and takes precedence over speed or convenience. It's better to ask and be certain than to implement incorrectly and waste time refactoring.

**Remember:** Every question asked upfront saves hours of refactoring later.

### 🎓 Iterative Clarification

**When Initial Answer Is Unclear:**
1. Acknowledge the response: "Thanks for clarifying..."
2. Ask follow-up if needed: "Just to confirm, does that mean..."
3. Summarize understanding: "So I'll implement it as..."
4. Proceed only when 100% clear

**Example:**
```
User: "Add authentication"
Agent: "Should I implement the full Module 1 authentication (JWT + MFA + RBAC + Sessions), or just basic JWT for now?"

User: "Just basic for now"
Agent: "Got it. Just to confirm, 'basic JWT' means:
  - Login endpoint with email/password
  - JWT access tokens (24h expiry)
  - No MFA, no refresh tokens, no session management yet
  Is that correct?"

User: "Yes, that's correct"
Agent: "Perfect, I'll implement basic JWT authentication with login endpoint and access tokens."
```

---

**Last Updated:** February 8, 2026
**Status:** ACTIVE - MANDATORY COMPLIANCE
