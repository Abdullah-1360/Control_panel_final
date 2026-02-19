---
inclusion: always
---

# OpsManager MCP Tools - Mandatory Usage Guidelines

## Overview

Model Context Protocol (MCP) tools provide specialized capabilities that MUST be used when working on specific tasks. This document defines mandatory usage patterns to ensure optimal development workflow and code quality.

## 🔴 CRITICAL: When MCP Tools Are MANDATORY

### 1. Memory MCP (mcp_memory_*) - ALWAYS REQUIRED

**MANDATORY for:**
- Reading plan documents for the first time
- Starting work on a new module
- Making architectural decisions
- Establishing integration points
- Completing module milestones
- Discovering module dependencies

**Usage Pattern:**
```typescript
// STEP 1: Query existing knowledge BEFORE starting work
await mcp_memory_search_nodes({ query: "Module 1 Authentication dependencies" });
await mcp_memory_open_nodes({ names: ["Module 1 - Authentication", "NestJS"] });

// STEP 2: Create entities for new components
await mcp_memory_create_entities({
  entities: [{
    name: "JWT Authentication Implementation",
    entityType: "Implementation",
    observations: [
      "Using jose library for RS256 signing",
      "Access token: 24h expiry in memory",
      "Refresh token: 7d expiry in HTTP-only cookie",
      "Implemented in Module 1 Sprint 1"
    ]
  }]
});

// STEP 3: Create relations for dependencies
await mcp_memory_create_relations({
  relations: [{
    from: "Module 1 - Authentication",
    to: "Module 2 - Servers",
    relationType: "BLOCKS"
  }]
});

// STEP 4: Update observations as work progresses
await mcp_memory_add_observations({
  observations: [{
    entityName: "Module 1 - Authentication",
    contents: [
      "Sprint 1 completed: Core authentication implemented",
      "Test coverage: 87%",
      "All acceptance criteria met"
    ]
  }]
});
```

**MANDATORY Triggers:**
- ✅ Before starting any new module implementation
- ✅ After reading plan documents
- ✅ After making technology choices
- ✅ After completing sprints/milestones
- ✅ When discovering integration points
- ✅ When encountering module dependencies

**Consequences of NOT Using:**
- ❌ Loss of project context across sessions
- ❌ Duplicate work or conflicting implementations
- ❌ Missing critical dependencies
- ❌ Inconsistent architectural decisions

---

### 2. Context7 MCP (mcp_context7_*) - MANDATORY for Library Documentation

**MANDATORY for:**
- Using any library for the first time
- Implementing authentication (jose, Argon2, speakeasy)
- Working with Prisma ORM
- Implementing NestJS features (guards, interceptors, decorators)
- Using Next.js App Router
- Implementing React Query patterns
- Working with shadcn/ui components
- Using BullMQ for job queues
- Implementing Redis operations

**Usage Pattern:**
```typescript
// STEP 1: Resolve library ID
const { libraryId } = await mcp_context7_resolve_library_id({
  libraryName: "jose",
  query: "How to implement JWT authentication with RS256 signing in Node.js"
});

// STEP 2: Query specific documentation
const docs = await mcp_context7_query_docs({
  libraryId: libraryId, // e.g., "/panva/jose"
  query: "Generate and verify JWT tokens with RS256 asymmetric signing"
});

// Use the documentation to implement correctly
```

**MANDATORY Use Cases:**

**Authentication Implementation:**
```typescript
// MUST query Context7 before implementing
await mcp_context7_resolve_library_id({ 
  libraryName: "jose",
  query: "JWT RS256 signing and verification"
});

await mcp_context7_resolve_library_id({ 
  libraryName: "argon2",
  query: "Password hashing with Argon2id"
});

await mcp_context7_resolve_library_id({ 
  libraryName: "speakeasy",
  query: "TOTP generation and verification for MFA"
});
```

**Prisma ORM:**
```typescript
// MUST query before implementing database operations
await mcp_context7_query_docs({
  libraryId: "/prisma/prisma",
  query: "Prisma transactions with nested operations"
});

await mcp_context7_query_docs({
  libraryId: "/prisma/prisma",
  query: "Prisma schema relations and indexes"
});
```

**NestJS Features:**
```typescript
// MUST query before implementing guards, interceptors, decorators
await mcp_context7_query_docs({
  libraryId: "/nestjs/nest",
  query: "Custom guards for JWT authentication"
});

await mcp_context7_query_docs({
  libraryId: "/nestjs/nest",
  query: "Custom decorators for extracting user from request"
});
```

**Next.js App Router:**
```typescript
// MUST query before implementing frontend features
await mcp_context7_query_docs({
  libraryId: "/vercel/next.js",
  query: "App Router middleware for authentication"
});

await mcp_context7_query_docs({
  libraryId: "/vercel/next.js",
  query: "Server actions and route handlers"
});
```

**React Query:**
```typescript
// MUST query before implementing data fetching
await mcp_context7_query_docs({
  libraryId: "/tanstack/query",
  query: "Optimistic updates with React Query"
});

await mcp_context7_query_docs({
  libraryId: "/tanstack/query",
  query: "Polling and real-time data with refetchInterval"
});
```

**MANDATORY Triggers:**
- ✅ Before using any library for the first time
- ✅ When implementing complex library features
- ✅ When encountering library-specific errors
- ✅ When upgrading library versions
- ✅ When library documentation is unclear

**Consequences of NOT Using:**
- ❌ Incorrect library usage patterns
- ❌ Security vulnerabilities from improper implementation
- ❌ Performance issues from non-optimal patterns
- ❌ Breaking changes from version mismatches

---

### 3. Frontend MCP (mcp_frontend_GetReactDocsByTopic) - MANDATORY for UI Development

**MANDATORY for:**
- Starting Module 9 (Admin Control Panel) implementation
- Implementing authentication UI
- Building dashboard components
- Creating forms with validation
- Implementing real-time updates
- Troubleshooting React/Next.js issues

**Usage Pattern:**
```typescript
// STEP 1: Get essential knowledge before starting
const essentials = await mcp_frontend_GetReactDocsByTopic({
  topic: "essential-knowledge"
});

// STEP 2: Get troubleshooting guide when encountering issues
const troubleshooting = await mcp_frontend_GetReactDocsByTopic({
  topic: "troubleshooting"
});
```

**MANDATORY Triggers:**
- ✅ Before starting Module 9 (Admin Control Panel)
- ✅ Before implementing any React component
- ✅ When encountering hydration errors
- ✅ When implementing forms with React Hook Form
- ✅ When setting up React Query
- ✅ When troubleshooting Next.js issues

**Consequences of NOT Using:**
- ❌ Common React pitfalls and anti-patterns
- ❌ Hydration mismatches in Next.js
- ❌ Improper state management
- ❌ Performance issues from unnecessary re-renders

---

### 4. Fetch MCP (mcp_fetch_fetch) - MANDATORY for External Documentation

**MANDATORY for:**
- Checking latest library versions
- Reading official documentation not in Context7
- Verifying API specifications
- Checking security advisories
- Reading blog posts for implementation patterns

**Usage Pattern:**
```typescript
// Fetch official documentation
const docs = await mcp_fetch_fetch({
  url: "https://docs.nestjs.com/security/authentication",
  max_length: 5000
});

// Fetch security advisories
const advisory = await mcp_fetch_fetch({
  url: "https://github.com/advisories/GHSA-xxxx-xxxx-xxxx"
});
```

**MANDATORY Triggers:**
- ✅ When Context7 doesn't have the library
- ✅ When checking for security vulnerabilities
- ✅ When verifying latest API specifications
- ✅ When reading implementation guides

**Consequences of NOT Using:**
- ❌ Outdated implementation patterns
- ❌ Missing security patches
- ❌ Incorrect API usage

---

### 5. Sequential Thinking MCP (mcp_sequential_thinking_sequentialthinking) - MANDATORY for Complex Problems

**MANDATORY for:**
- Designing state machines (Module 6 - Incidents)
- Planning circuit breaker logic (Module 6)
- Designing playbook execution flow (Module 5)
- Planning database schema with complex relations
- Designing authentication flow with MFA
- Planning module integration points
- Troubleshooting complex bugs

**Usage Pattern:**
```typescript
// Use for complex problem-solving
await mcp_sequential_thinking_sequentialthinking({
  thought: "Need to design incident state machine with strict transitions",
  thoughtNumber: 1,
  totalThoughts: 5,
  nextThoughtNeeded: true
});

// Continue thinking through the problem
await mcp_sequential_thinking_sequentialthinking({
  thought: "States: NEW, INVESTIGATING, FIX_IN_PROGRESS, MONITORING, RESOLVED, ESCALATED",
  thoughtNumber: 2,
  totalThoughts: 5,
  nextThoughtNeeded: true
});

// Validate the solution
await mcp_sequential_thinking_sequentialthinking({
  thought: "Validation: All transitions must be logged, invalid transitions rejected",
  thoughtNumber: 5,
  totalThoughts: 5,
  nextThoughtNeeded: false
});
```

**MANDATORY Triggers:**
- ✅ Before implementing state machines
- ✅ Before designing complex algorithms
- ✅ When planning multi-step workflows
- ✅ When troubleshooting complex bugs
- ✅ When designing integration points

**Consequences of NOT Using:**
- ❌ Incomplete problem analysis
- ❌ Missing edge cases
- ❌ Flawed architectural decisions
- ❌ Difficult-to-debug implementations

---

## 🟡 RECOMMENDED: When MCP Tools Should Be Used

### Web Search (remote_web_search) - Use for Current Information

**Recommended for:**
- Checking latest library versions
- Finding recent security advisories
- Discovering new best practices
- Researching implementation patterns

**Usage Pattern:**
```typescript
const results = await remote_web_search({
  query: "NestJS JWT authentication best practices 2026"
});
```

---

## 📋 MCP Usage Checklist by Module

### Module 1: Authentication & Authorization

**MANDATORY:**
- ✅ Memory: Create "Module 1 - Authentication" entity before starting
- ✅ Context7: Query jose, argon2, speakeasy documentation
- ✅ Context7: Query NestJS guards and decorators
- ✅ Sequential Thinking: Design authentication flow with MFA
- ✅ Memory: Document JWT implementation decisions
- ✅ Memory: Update status after each sprint

**Example Workflow:**
```typescript
// 1. Query existing knowledge
await mcp_memory_search_nodes({ query: "Module 1 Authentication" });

// 2. Get library documentation
await mcp_context7_resolve_library_id({ 
  libraryName: "jose",
  query: "JWT RS256 signing"
});

// 3. Think through complex flow
await mcp_sequential_thinking_sequentialthinking({
  thought: "Design MFA flow: login → password check → MFA challenge → token generation",
  thoughtNumber: 1,
  totalThoughts: 3,
  nextThoughtNeeded: true
});

// 4. Document implementation
await mcp_memory_create_entities({
  entities: [{
    name: "JWT Authentication Implementation",
    entityType: "Implementation",
    observations: ["Using jose with RS256", "24h access token", "7d refresh token"]
  }]
});
```

---

### Module 2: Server Connection Management

**MANDATORY:**
- ✅ Memory: Query Module 1 dependencies before starting
- ✅ Context7: Query ssh2 library documentation
- ✅ Context7: Query libsodium-wrappers for encryption
- ✅ Sequential Thinking: Design connection testing flow
- ✅ Memory: Document encryption implementation
- ✅ Memory: Create relation to Module 1

---

### Module 5: Automation & Workflow Engine

**MANDATORY:**
- ✅ Memory: Query Module 2 (SSH) and Module 6 (Incidents) dependencies
- ✅ Context7: Query BullMQ for job queue implementation
- ✅ Sequential Thinking: Design playbook execution flow with retry logic
- ✅ Sequential Thinking: Design circuit breaker pattern
- ✅ Memory: Document playbook implementations
- ✅ Memory: Create integration relations

---

### Module 6: Incident Management

**MANDATORY:**
- ✅ Memory: Query all dependent modules (1, 4, 5, 7, 8)
- ✅ Sequential Thinking: Design state machine with all transitions
- ✅ Sequential Thinking: Design circuit breaker escalation logic
- ✅ Sequential Thinking: Design SLA tracking algorithm
- ✅ Memory: Document state machine implementation
- ✅ Memory: Document integration points with Module 5 and 8

---

### Module 9: Admin Control Panel

**MANDATORY:**
- ✅ Memory: Query all backend modules (1-8) for API endpoints
- ✅ Frontend: Get essential React knowledge
- ✅ Context7: Query Next.js App Router documentation
- ✅ Context7: Query React Query for data fetching
- ✅ Context7: Query shadcn/ui component documentation
- ✅ Frontend: Get troubleshooting guide when issues arise
- ✅ Memory: Document UI component architecture

---

## 🚨 Enforcement Rules

### Rule 1: Memory MUST Be Updated
**Trigger:** After reading plan documents, making decisions, completing sprints
**Action:** Create entities, relations, and observations
**Validation:** Query memory before starting new work to verify updates

### Rule 2: Context7 MUST Be Queried
**Trigger:** Before using any library for the first time
**Action:** Resolve library ID and query documentation
**Validation:** Implementation follows documented patterns

### Rule 3: Sequential Thinking MUST Be Used
**Trigger:** Before implementing complex logic (state machines, algorithms)
**Action:** Think through problem step-by-step with validation
**Validation:** Solution handles all edge cases

### Rule 4: Frontend MCP MUST Be Consulted
**Trigger:** Before starting Module 9 or any React component
**Action:** Get essential knowledge and troubleshooting guide
**Validation:** Implementation follows React best practices

---

## 🎯 Quick Reference: When to Use Which MCP

| Task | MCP Tool | Mandatory? |
|------|----------|------------|
| Starting new module | Memory (search + create) | ✅ YES |
| Using library first time | Context7 (resolve + query) | ✅ YES |
| Implementing state machine | Sequential Thinking | ✅ YES |
| Building React components | Frontend + Context7 | ✅ YES |
| Making architectural decision | Memory + Sequential Thinking | ✅ YES |
| Completing sprint | Memory (add observations) | ✅ YES |
| Checking latest versions | Web Search | 🟡 Recommended |
| Reading external docs | Fetch | 🟡 Recommended |
| Troubleshooting bugs | Sequential Thinking | ✅ YES (if complex) |
| Documenting integration | Memory (create relations) | ✅ YES |

---

## ⚠️ Consequences of Non-Compliance

### Not Using Memory MCP:
- Loss of project context across sessions
- Duplicate or conflicting implementations
- Missing critical dependencies
- Inconsistent architectural decisions

### Not Using Context7 MCP:
- Incorrect library usage patterns
- Security vulnerabilities
- Performance issues
- Breaking changes from version mismatches

### Not Using Sequential Thinking MCP:
- Incomplete problem analysis
- Missing edge cases
- Flawed architectural decisions
- Difficult-to-debug implementations

### Not Using Frontend MCP:
- React anti-patterns
- Hydration mismatches
- Improper state management
- Performance issues

---

## �� MCP Usage Log Template

After using MCP tools, document the usage:

```markdown
## MCP Usage Log

### Date: 2026-02-08
### Module: Module 1 - Authentication
### Task: Implementing JWT authentication

**Memory MCP:**
- ✅ Queried existing Module 1 knowledge
- ✅ Created "JWT Authentication Implementation" entity
- ✅ Created relation: Module 1 BLOCKS Module 2

**Context7 MCP:**
- ✅ Queried jose library for RS256 signing
- ✅ Queried argon2 for password hashing
- ✅ Queried NestJS guards documentation

**Sequential Thinking MCP:**
- ✅ Designed authentication flow (5 thoughts)
- ✅ Validated MFA integration (3 thoughts)

**Outcome:**
- JWT authentication implemented correctly
- All security best practices followed
- Test coverage: 87%
```

---

## 🔄 Continuous Improvement

This document should be updated when:
- New MCP tools become available
- New use cases are discovered
- Best practices evolve
- Team feedback suggests improvements

**Last Updated:** February 8, 2026
**Next Review:** March 8, 2026
