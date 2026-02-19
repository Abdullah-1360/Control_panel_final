---
inclusion: always
---

# OpsManager Memory & Context Management

## When to Update Memory

Update the knowledge graph when you encounter:

### Project Structure Changes
- New modules or features added
- Directory structure modifications
- New dependencies or libraries introduced
- Architecture pattern changes

### Key Decisions
- Technology stack choices
- Design pattern selections
- Security implementation decisions
- Performance optimization strategies
- API design decisions

### Implementation Progress
- Module completion status
- Sprint milestones reached
- Integration points established
- Testing coverage achievements

### Important Relationships
- Module dependencies
- Service integrations
- Data flow patterns
- User role hierarchies

## What to Store in Memory

### Entities to Create

**Project Entity**
```
Name: OpsManager
Type: Project
Observations:
- Enterprise infrastructure management platform
- 9 core modules across 4 phases
- 36-week implementation timeline
- Target: 10,000+ assets, 1,000+ concurrent users
```

**Module Entities** (Create for each of 9 modules)
```
Name: Module 1 - Authentication & Authorization
Type: Module
Observations:
- P0 priority (CRITICAL PATH)
- 6-8 week implementation
- JWT with RS256, MFA with TOTP
- Argon2id password hashing
- Redis session management
- Dependencies: None (foundation)
```

**Technology Entities**
```
Name: NestJS
Type: Technology
Observations:
- Backend framework
- TypeScript with dependency injection
- Used across all backend modules
- Version 10+

Name: Next.js
Type: Technology
Observations:
- Frontend framework
- App Router architecture
- Used for Module 9 (Admin Panel)
- Version 14
```

**Pattern Entities**
```
Name: State Machine Pattern
Type: DesignPattern
Observations:
- Used in Module 6 (Incident Management)
- Strict status transitions
- Validation on every transition
- Audit logging built-in

Name: Circuit Breaker Pattern
Type: DesignPattern
Observations:
- Used in Module 6 (Incident Management)
- Automatic escalation after max retries
- Prevents infinite retry loops
```

### Relations to Create

**Module Dependencies**
```
Module 1 (Auth) -> BLOCKS -> Module 2 (Servers)
Module 1 (Auth) -> BLOCKS -> Module 3 (Integrations)
Module 2 (Servers) -> REQUIRED_BY -> Module 4 (Assets)
Module 2 (Servers) -> REQUIRED_BY -> Module 5 (Automation)
Module 4 (Assets) -> REQUIRED_BY -> Module 6 (Incidents)
Module 5 (Automation) -> INTEGRATES_WITH -> Module 6 (Incidents)
Module 6 (Incidents) -> USES -> Module 7 (Logging)
Module 6 (Incidents) -> TRIGGERS -> Module 8 (Notifications)
Module 9 (Admin Panel) -> CONSUMES -> All Modules
```

**Technology Usage**
```
NestJS -> USED_IN -> Backend Modules
Next.js -> USED_IN -> Module 9 (Admin Panel)
Prisma -> USED_IN -> All Backend Modules
PostgreSQL -> STORES_DATA_FOR -> All Modules
Redis -> CACHES_FOR -> Module 1, Module 5, Module 6, Module 8
BullMQ -> QUEUES_JOBS_FOR -> Module 5, Module 6, Module 7, Module 8
```

**Pattern Applications**
```
State Machine Pattern -> IMPLEMENTED_IN -> Module 6 (Incidents)
Circuit Breaker Pattern -> IMPLEMENTED_IN -> Module 6 (Incidents)
Strategy Pattern -> IMPLEMENTED_IN -> Module 5 (Automation)
Adapter Pattern -> IMPLEMENTED_IN -> Module 3 (Integrations), Module 8 (Notifications)
Factory Pattern -> IMPLEMENTED_IN -> Module 3 (Integrations)
```

## Memory Update Triggers

### After Reading Plan Documents
```typescript
// Create project entity
await createEntity({
  name: "OpsManager",
  type: "Project",
  observations: [
    "Enterprise infrastructure management platform",
    "9 core modules: Auth, Servers, Integrations, Assets, Automation, Incidents, Logging, Notifications, Admin Panel",
    "36-week implementation timeline across 5 phases",
    "Tech stack: NestJS, Next.js, PostgreSQL, Redis, Prisma"
  ]
});

// Create module entities
for (const module of modules) {
  await createEntity({
    name: module.name,
    type: "Module",
    observations: module.observations
  });
}

// Create dependency relations
await createRelations({
  relations: moduleDependencies.map(dep => ({
    from: dep.source,
    to: dep.target,
    relationType: dep.type
  }))
});
```

### After Implementation Decisions
```typescript
// Store decision
await createEntity({
  name: "JWT Authentication Decision",
  type: "Decision",
  observations: [
    "Chose JWT with RS256 asymmetric signing",
    "Access token: 24h expiry, stored in memory",
    "Refresh token: 7d expiry, HTTP-only cookie",
    "Rationale: Security, scalability, stateless"
  ]
});

// Link to module
await createRelation({
  from: "JWT Authentication Decision",
  to: "Module 1 - Authentication",
  relationType: "APPLIES_TO"
});
```

### After Module Completion
```typescript
// Update module status
await addObservations({
  entityName: "Module 1 - Authentication",
  contents: [
    "Status: COMPLETED",
    "Completion date: 2026-02-15",
    "Test coverage: 87%",
    "All acceptance criteria met"
  ]
});
```

### After Integration Points Established
```typescript
// Document integration
await createEntity({
  name: "Incident-Automation Integration",
  type: "Integration",
  observations: [
    "Module 6 triggers Module 5 playbooks",
    "Circuit breaker escalates after max attempts",
    "Real-time status updates via callbacks",
    "Execution logs stored in Module 7"
  ]
});

await createRelations({
  relations: [
    {
      from: "Module 6 - Incidents",
      to: "Incident-Automation Integration",
      relationType: "IMPLEMENTS"
    },
    {
      from: "Module 5 - Automation",
      to: "Incident-Automation Integration",
      relationType: "IMPLEMENTS"
    }
  ]
});
```

## Query Patterns for Context Retrieval

### Before Starting New Module
```typescript
// Get module dependencies
const dependencies = await searchNodes("Module X dependencies");

// Get related technologies
const technologies = await searchNodes("Module X technologies");

// Get design patterns
const patterns = await searchNodes("Module X patterns");
```

### Before Making Architectural Decision
```typescript
// Check existing decisions
const decisions = await searchNodes("authentication decisions");

// Check constraints
const constraints = await searchNodes("security constraints");

// Check related modules
const relatedModules = await searchNodes("authentication related modules");
```

### During Implementation
```typescript
// Get implementation details
const details = await openNodes(["Module 1 - Authentication"]);

// Get integration points
const integrations = await searchNodes("Module 1 integrations");

// Get testing requirements
const testing = await searchNodes("Module 1 testing");
```

## Memory Maintenance

### Regular Updates
- Update module status after each sprint
- Document new integration points as discovered
- Record performance metrics after optimization
- Update test coverage after test implementation

### Cleanup
- Remove outdated observations
- Consolidate duplicate entities
- Update relations when dependencies change
- Archive completed phases

### Validation
- Verify all module dependencies are documented
- Ensure all technologies are linked to modules
- Confirm all design patterns are documented
- Validate all integration points are recorded

## Example Memory Structure

```
OpsManager (Project)
├── Phase 1: Foundation
│   └── Module 1: Authentication
│       ├── Uses: NestJS, Prisma, Redis, jose, Argon2id
│       ├── Implements: JWT Authentication, MFA, RBAC
│       ├── Blocks: Module 2, Module 3, Module 4
│       └── Status: COMPLETED
├── Phase 2: Infrastructure
│   ├── Module 2: Servers
│   │   ├── Uses: NestJS, Prisma, ssh2, libsodium
│   │   ├── Depends On: Module 1
│   │   ├── Required By: Module 4, Module 5
│   │   └── Status: IN_PROGRESS
│   ├── Module 3: Integrations
│   │   ├── Uses: NestJS, Prisma, axios
│   │   ├── Implements: Adapter Pattern, Factory Pattern
│   │   ├── Depends On: Module 1
│   │   └── Status: PLANNED
│   └── Module 4: Assets
│       ├── Uses: NestJS, Prisma, BullMQ
│       ├── Depends On: Module 1, Module 2, Module 3
│       └── Status: PLANNED
├── Phase 3: Operations
│   ├── Module 5: Automation
│   ├── Module 6: Incidents
│   └── Module 7: Logging
├── Phase 4: Communication
│   ├── Module 8: Notifications
│   └── Module 9: Admin Panel
└── Design Patterns
    ├── State Machine (Module 6)
    ├── Circuit Breaker (Module 6)
    ├── Strategy Pattern (Module 5)
    ├── Adapter Pattern (Module 3, Module 8)
    └── Factory Pattern (Module 3)
```

## Critical Memory Rules

1. **Always update after major decisions** - Architecture, technology, design patterns
2. **Document all module dependencies** - Prevents integration issues
3. **Record integration points** - Enables smooth module connections
4. **Track implementation progress** - Maintains project visibility
5. **Link technologies to modules** - Ensures consistent tech stack usage
6. **Store rationale for decisions** - Helps future decision-making
7. **Update status regularly** - Keeps memory current
8. **Clean up outdated info** - Prevents confusion
9. **Validate relationships** - Ensures accuracy
10. **Query before implementing** - Leverage existing knowledge
