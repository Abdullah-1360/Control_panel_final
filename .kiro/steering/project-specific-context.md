---
inclusion: always
---

# OpsManager Project-Specific Context

## Project Location & Structure

### Workspace
- **Root Directory:** `/home/abdullah/StudioProjects/final_CP`
- **Plan Directory:** `/home/abdullah/StudioProjects/final_CP/plan`
- **Steering Directory:** `/home/abdullah/StudioProjects/final_CP/.kiro/steering`

### Expected Project Structure (To Be Created)
```
final_CP/
├── backend/                 # NestJS backend application
│   ├── src/
│   │   ├── modules/        # Feature modules
│   │   ├── common/         # Shared utilities
│   │   ├── prisma/         # Database schema
│   │   └── main.ts         # Application entry
│   ├── test/               # Test files
│   ├── prisma/             # Prisma migrations
│   └── package.json
├── frontend/               # Next.js frontend application
│   ├── src/
│   │   ├── app/           # Next.js App Router
│   │   ├── components/    # React components
│   │   ├── lib/           # Utilities and API clients
│   │   └── types/         # TypeScript types
│   ├── public/            # Static assets
│   └── package.json
├── docker-compose.yml     # Local development environment
├── .env.example           # Environment variable template
└── README.md              # Project documentation
```

## Implementation Plan Reference

### Plan Documents Location
All implementation plans are in `/home/abdullah/StudioProjects/final_CP/plan/`:
- `0. MASTER_IMPLEMENTATION_ROADMAP.md` - Overall project roadmap
- `1. Auth + RBAC + Sessions + MFA (foundation for everything).md` - Module 1
- `2. Server Connections Module.md` - Module 2
- `3.Site Management.md` - Module 3 (Integration Hub)
- `4.Universal_Asset_Registry.md` - Module 4
- `5.Automation_WOrkflow_engine.md` - Module 5
- `6.Incident_management_core.md` - Module 6
- `7.logging_and_Event_store.md` - Module 7
- `8.Notifications_And_comm_Rules.md` - Module 8
- `9.Admin_Control_Panel.md` - Module 9
- `TRANSFORMATION_STATUS.md` - Implementation progress tracker

### Current Status (as of February 8, 2026)
- **Modules Completed:** 8 of 9 (89%)
- **Modules Remaining:** Module 9 (Admin Control Panel) - partially complete
- **Phase:** All planning complete, ready for implementation

## Module Implementation Order

### Phase 1: Foundation (Weeks 1-8) - CRITICAL PATH
1. **Module 1: Authentication & Authorization** (P0)
   - Duration: 6-8 weeks
   - Team: 2-3 Full-Stack Engineers
   - Blocks: All other modules
   - Status: Plan complete, ready for implementation

### Phase 2: Infrastructure Core (Weeks 9-16)
2. **Module 2: Server Connection Management** (P0)
   - Duration: 4-5 weeks
   - Team: 2 Backend, 1 Frontend
   - Depends on: Module 1
   - Status: Plan complete

3. **Module 3: Integration Hub** (P1)
   - Duration: 3-4 weeks
   - Team: 2 Backend Engineers
   - Depends on: Module 1
   - Status: Plan complete

4. **Module 4: Universal Asset Registry** (P1)
   - Duration: 4-5 weeks
   - Team: 2 Backend, 1 Frontend
   - Depends on: Module 1, 2, 3
   - Status: Plan complete

### Phase 3: Operations & Automation (Weeks 17-24)
5. **Module 7: Logging & Event Store** (P0)
   - Duration: 3 weeks
   - Team: 2 Developers
   - Depends on: Module 1
   - Status: Plan complete

6. **Module 6: Incident Management** (P1)
   - Duration: 4 weeks
   - Team: 2-3 Developers
   - Depends on: Module 1, 4, 5, 7, 8
   - Status: Plan complete

7. **Module 5: Automation & Workflow Engine** (P1)
   - Duration: 5 weeks
   - Team: 2-3 Developers
   - Depends on: Module 1, 2, 3, 6
   - Status: Plan complete

### Phase 4: Communication & Control (Weeks 25-32)
8. **Module 8: Notification & Communication Bus** (P1)
   - Duration: 3 weeks
   - Team: 2 Developers
   - Depends on: Module 1, 5, 6, 7
   - Status: Plan complete

9. **Module 9: Admin Control Panel** (P0)
   - Duration: 6-8 weeks
   - Team: 2-3 Frontend Engineers
   - Depends on: All modules
   - Status: Plan partially complete

## Key Project Constraints

### Technical Constraints
1. **NO External Automation Tools** - Pure TypeScript playbooks only (no Ansible, n8n, Jenkins)
2. **NO OAuth/SSO in Phase 1** - JWT-only authentication initially
3. **NO Mobile Native Apps** - Responsive web only
4. **PostgreSQL Only** - No multi-database support initially
5. **Node.js 20+** - Minimum runtime version
6. **TypeScript Strict Mode** - All code must pass strict type checking

### Security Constraints
1. **Encryption Required** - All credentials encrypted with libsodium-wrappers
2. **Audit Logging Mandatory** - Every security-relevant action logged
3. **RBAC Enforced** - Permission checks on all protected endpoints
4. **No Plaintext Secrets** - Environment variables for all secrets
5. **TLS 1.3 Required** - All API communication encrypted

### Performance Constraints
1. **API Response Time:** <200ms (p95)
2. **Page Load Time:** <2s
3. **Database Query:** <100ms
4. **Log Ingestion:** 10,000+ events/second
5. **Concurrent Users:** 1,000+
6. **Managed Assets:** 10,000+

### Testing Constraints
1. **Unit Test Coverage:** >80%
2. **Integration Tests:** All API endpoints
3. **E2E Tests:** All critical user journeys
4. **Security Tests:** SAST, DAST, dependency scanning

## Module Dependencies Map

```
Module 1 (Auth)
    ↓ BLOCKS
    ├─→ Module 2 (Servers)
    │       ↓ REQUIRED_BY
    │       ├─→ Module 4 (Assets)
    │       │       ↓ REQUIRED_BY
    │       │       └─→ Module 6 (Incidents)
    │       └─→ Module 5 (Automation)
    │               ↓ INTEGRATES_WITH
    │               └─→ Module 6 (Incidents)
    ├─→ Module 3 (Integrations)
    │       ↓ REQUIRED_BY
    │       └─→ Module 4 (Assets)
    ├─→ Module 7 (Logging)
    │       ↓ USED_BY
    │       └─→ All Modules
    └─→ Module 8 (Notifications)
            ↓ TRIGGERED_BY
            └─→ Module 6 (Incidents)

Module 9 (Admin Panel)
    ↓ CONSUMES
    └─→ All Modules (1-8)
```

## Critical Integration Points

### Module 1 → Module 2
- JWT authentication for server management endpoints
- RBAC permissions: `servers.create`, `servers.read`, `servers.update`, `servers.delete`
- Audit logging for all server operations

### Module 2 → Module 5
- SSH connection profiles used by automation playbooks
- Credential decryption for command execution
- Connection testing before playbook execution

### Module 5 → Module 6
- Playbook execution triggered by incidents
- Circuit breaker escalates after max attempts
- Execution logs stored in incident timeline

### Module 6 → Module 8
- Incident status changes trigger notifications
- Severity escalation triggers alerts
- SLA breaches trigger escalation notifications

### Module 7 → All Modules
- All modules log to centralized event store
- Structured logging with context
- Automatic PII redaction

## Environment Setup Requirements

### Development Environment
```bash
# Required software
- Node.js 20+
- PostgreSQL 16
- Redis 7
- Docker & Docker Compose
- pnpm (package manager)

# Environment variables (.env)
DATABASE_URL=postgresql://user:pass@localhost:5432/opsmanager_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=<generate-secure-secret>
ENCRYPTION_KEY=<generate-32-byte-key>
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=test
SMTP_PASS=test
```

### Docker Compose Services
```yaml
services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: opsmanager_dev
      POSTGRES_USER: opsmanager
      POSTGRES_PASSWORD: dev_password
  
  redis:
    image: redis:7
    ports: ["6379:6379"]
  
  mailhog:
    image: mailhog/mailhog
    ports: ["1025:1025", "8025:8025"]
```

## Common Development Commands

### Backend
```bash
cd backend
pnpm install
pnpm prisma generate
pnpm prisma migrate dev
pnpm run start:dev
pnpm test
pnpm test:e2e
```

### Frontend
```bash
cd frontend
pnpm install
pnpm run dev
pnpm run build
pnpm test
```

## API Endpoint Conventions

### URL Structure
- Base URL: `http://localhost:3001/api/v1`
- Resource pattern: `/api/v1/{resource}`
- Nested resources: `/api/v1/{parent}/{id}/{child}`

### Examples
```
POST   /api/v1/auth/login
GET    /api/v1/servers
GET    /api/v1/servers/:id
POST   /api/v1/servers/:id/test
GET    /api/v1/assets
POST   /api/v1/incidents
GET    /api/v1/incidents/:id/timeline
POST   /api/v1/automation/playbooks/:id/execute
```

## Database Naming Conventions

### Tables
- Use snake_case: `users`, `system_logs`, `automation_executions`
- Plural names for entity tables
- Junction tables: `{entity1}_{entity2}` (e.g., `user_roles`)

### Columns
- Use camelCase in Prisma schema
- Automatically converted to snake_case in database
- Foreign keys: `{entity}Id` (e.g., `userId`, `serverId`)

### Indexes
- Primary key: `id` (UUID)
- Foreign keys: Always indexed
- Frequently queried fields: Add index
- Composite indexes for multi-column queries

## Testing Conventions

### Test File Naming
- Unit tests: `{filename}.spec.ts`
- Integration tests: `{filename}.integration.spec.ts`
- E2E tests: `{feature}.e2e-spec.ts`

### Test Organization
```typescript
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should do something when condition', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

## Git Commit Conventions

### Commit Message Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Build/tooling changes

### Examples
```
feat(auth): implement MFA with TOTP
fix(servers): resolve connection timeout issue
docs(api): update authentication endpoint documentation
refactor(incidents): extract state machine logic
test(automation): add playbook execution tests
```

## Project-Specific Acronyms

- **MTTR:** Mean Time To Resolution
- **RBAC:** Role-Based Access Control
- **MFA:** Multi-Factor Authentication
- **TOTP:** Time-Based One-Time Password
- **JWT:** JSON Web Token
- **SLA:** Service Level Agreement
- **NOC:** Network Operations Center
- **SSH:** Secure Shell
- **SSL:** Secure Sockets Layer
- **WHM:** WebHost Manager
- **WHMCS:** Web Host Manager Complete Solution
- **DTO:** Data Transfer Object
- **ORM:** Object-Relational Mapping

## Quick Reference Links

### Plan Documents
- Master Roadmap: `plan/0. MASTER_IMPLEMENTATION_ROADMAP.md`
- Current Module: Check `plan/TRANSFORMATION_STATUS.md`
- Module Details: `plan/{module-number}.{module-name}.md`

### Steering Files
- Product Context: `.kiro/steering/product.md`
- Tech Stack: `.kiro/steering/tech-stack.md`
- Behavior Guidelines: `.kiro/steering/behaviour.md`
- Memory Management: `.kiro/steering/memory-updater.md`
- This File: `.kiro/steering/project-specific-context.md`

## Next Steps for Implementation

1. **Initialize Project Structure**
   - Create backend/ and frontend/ directories
   - Initialize NestJS and Next.js projects
   - Setup Docker Compose for local development

2. **Start with Module 1 (Authentication)**
   - Follow plan in `plan/1. Auth + RBAC + Sessions + MFA (foundation for everything).md`
   - Implement Sprint 1-2: Core Authentication
   - Achieve >80% test coverage
   - Complete before moving to Module 2

3. **Follow Module Dependency Order**
   - Never start a module before its dependencies are complete
   - Refer to dependency map above
   - Update TRANSFORMATION_STATUS.md after each module

4. **Maintain Quality Standards**
   - Run tests before committing
   - Follow TypeScript strict mode
   - Implement security best practices
   - Document all API endpoints
   - Update memory graph after major decisions
