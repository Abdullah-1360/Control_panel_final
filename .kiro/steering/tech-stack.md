---
inclusion: always
---

# OpsManager Technology Stack

## Backend Stack

### Core Framework
- **NestJS 10+** - TypeScript framework with dependency injection
- **Node.js 20+** - Runtime environment
- **TypeScript 5+** - Type-safe development

### Database & ORM
- **PostgreSQL 16** - Primary database with JSONB support
- **Prisma ORM** - Type-safe database access with migrations
- **Redis 7** - Session cache, job queue, rate limiting

### Authentication & Security
- **jose** - JWT operations with RS256 signing
- **Argon2id** - Password hashing (industry-leading security)
- **libsodium-wrappers** - Credential encryption (XSalsa20-Poly1305)
- **speakeasy** - TOTP generation for MFA

### Job Queue & Background Processing
- **BullMQ** - Redis-based job queue for automation, retention, SLA monitoring
- **Cron** - Scheduled tasks (@nestjs/schedule)

### External Communication
- **ssh2** - SSH connection library for remote command execution
- **axios** - HTTP client for API integrations
- **Nodemailer** - Email delivery (SMTP)

### Validation & Serialization
- **class-validator** - DTO validation decorators
- **class-transformer** - Object serialization

## Frontend Stack

### Core Framework
- **Next.js 14** - React framework with App Router
- **React 18** - UI library
- **TypeScript 5+** - Type-safe development

### State Management
- **React Query (TanStack Query)** - Server state management with caching
- **Zustand** - Client-side global state (lightweight)

### UI Components & Styling
- **shadcn/ui** - Radix UI primitives with Tailwind
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Icon library
- **Recharts** - Chart library for dashboards

### Forms & Validation
- **React Hook Form** - Form state management
- **Zod** - Schema validation (shared with backend)

### Real-Time Updates
- **React Query Polling** - 2-5 second intervals for live data
- **WebSocket (Future)** - True real-time for critical updates

### Additional Libraries
- **react-flow** - Relationship graph visualization
- **@dnd-kit** - Drag-and-drop for Kanban boards
- **date-fns** - Date formatting and manipulation

## Infrastructure Stack

### Development
- **Docker** - Containerization
- **Docker Compose** - Local development environment
- **pnpm** - Package manager (faster than npm)

### Production
- **Kubernetes** - Container orchestration
- **Nginx** - Reverse proxy and load balancer
- **PostgreSQL HA** - High-availability database cluster
- **Redis Cluster** - Distributed cache with persistence

### CI/CD
- **GitHub Actions** - Automated testing and deployment
- **Docker Registry** - Container image storage

### Monitoring & Observability
- **Prometheus** - Metrics collection
- **Grafana** - Metrics visualization
- **Loki** - Log aggregation
- **Sentry (Future)** - Error tracking

## Development Tools

### Code Quality
- **ESLint** - Linting for TypeScript/JavaScript
- **Prettier** - Code formatting
- **Husky** - Git hooks for pre-commit checks
- **lint-staged** - Run linters on staged files

### Testing
- **Jest** - Unit testing framework
- **Supertest** - API integration testing
- **Playwright** - E2E testing
- **@testing-library/react** - React component testing

### Documentation
- **Swagger/OpenAPI** - API documentation
- **Storybook (Future)** - Component documentation

## Architecture Patterns

### Backend Patterns
- **Dependency Injection** - NestJS built-in DI container
- **Repository Pattern** - Data access abstraction via Prisma
- **Strategy Pattern** - Playbook execution, channel adapters
- **Factory Pattern** - Integration client factory
- **State Machine** - Incident lifecycle management
- **Circuit Breaker** - Retry limits with escalation
- **Adapter Pattern** - Multi-channel notifications

### Frontend Patterns
- **Atomic Design** - Component hierarchy (atoms, molecules, organisms)
- **Container/Presenter** - Separate logic from presentation
- **Optimistic Updates** - Instant UI feedback with background sync
- **Progressive Disclosure** - Show essential info first, details on demand

## Performance Targets

### Backend
- API Response Time: <200ms (p95)
- Database Query: <100ms
- Log Ingestion: 10,000+ events/second
- Concurrent Users: 1,000+
- Managed Assets: 10,000+

### Frontend
- Page Load Time: <2s
- Real-Time Update Latency: <500ms
- Time to Interactive: <3s
- Lighthouse Score: >90

## Security Standards

### Encryption
- **At Rest:** libsodium-wrappers for credentials
- **In Transit:** TLS 1.3 for all API communication
- **Tokens:** RS256 asymmetric JWT signing

### Authentication
- **Access Token:** 24-hour expiry (memory storage)
- **Refresh Token:** 7-day expiry (HTTP-only cookie)
- **MFA:** TOTP with 30-second window

### Authorization
- **RBAC:** Permission-based access control
- **Guards:** NestJS guards on all protected routes
- **Audit Logging:** Every action logged with actor

## Database Design Principles

### Schema Design
- **Prisma Schema First** - Define models in schema.prisma
- **Migrations** - Version-controlled database changes
- **Indexes** - Strategic indexing for performance
- **JSONB** - Flexible metadata storage (Asset.metadata, Log.metadata)

### Naming Conventions
- **Tables:** snake_case (users, system_logs)
- **Columns:** camelCase in Prisma, snake_case in DB
- **Relations:** Explicit foreign keys with onDelete rules

### Performance
- **Connection Pooling** - Prisma connection pool
- **Query Optimization** - Include only needed relations
- **Pagination** - Cursor-based for large datasets
- **Materialized Views (Future)** - Pre-computed aggregations

## API Design Principles

### REST API Standards
- **Versioning:** /api/v1/resource
- **HTTP Methods:** GET (read), POST (create), PATCH (update), DELETE (delete)
- **Status Codes:** 200 (OK), 201 (Created), 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 409 (Conflict), 500 (Server Error)
- **Pagination:** page, limit, total, totalPages
- **Filtering:** Query parameters (status, type, search)
- **Sorting:** sort, order (asc/desc)

### Response Format
```typescript
// Success
{ data: T, pagination?: {...} }

// Error
{ error: string, message: string, statusCode: number }
```

## Code Organization

### Backend Structure
```
backend/
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   ├── servers/
│   │   ├── assets/
│   │   ├── incidents/
│   │   ├── automation/
│   │   └── ...
│   ├── common/
│   │   ├── guards/
│   │   ├── decorators/
│   │   ├── filters/
│   │   └── interceptors/
│   ├── prisma/
│   │   └── schema.prisma
│   └── main.ts
├── test/
└── package.json
```

### Frontend Structure
```
frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   └── [feature]/
│   ├── lib/
│   │   ├── api/
│   │   ├── auth/
│   │   └── utils/
│   └── types/
├── public/
└── package.json
```

## Version Control

### Git Workflow
- **Main Branch:** Production-ready code
- **Develop Branch:** Integration branch
- **Feature Branches:** feature/module-name
- **Commit Convention:** Conventional Commits (feat:, fix:, docs:, refactor:)

### Branch Protection
- Require pull request reviews
- Require status checks to pass
- No direct commits to main

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
ENCRYPTION_KEY=...
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Critical Rules

1. **NO External Automation Tools** - Pure TypeScript playbooks only
2. **Type Safety Everywhere** - Use TypeScript strict mode
3. **Security First** - Encrypt credentials, audit everything, RBAC on all endpoints
4. **Test Coverage >80%** - Unit, integration, and E2E tests
5. **Real-Time Updates** - React Query polling (2-5s intervals)
6. **Optimistic UI** - Instant feedback with background sync
7. **Error Handling** - Comprehensive try-catch, user-friendly messages
8. **Logging** - Log all actions to Module 7 (Event Store)
9. **Performance** - <200ms API response, <2s page load
10. **Accessibility** - WCAG AA compliance
