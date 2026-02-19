# OpsManager Documentation

**Last Updated:** February 18, 2026  
**Project Status:** Active Development - Multiple Modules Complete

---

## 📚 Documentation Structure

This documentation is organized into 8 main categories for easy navigation and understanding of the project state.

```
docs/
├── 01-getting-started/          # Setup and quick start guides
├── 02-modules/                  # Module-specific documentation
│   ├── module1/                 # Authentication & Authorization (COMPLETE)
│   ├── module2/                 # Server Connection Management (COMPLETE)
│   ├── module4/                 # WordPress Auto-Healer (COMPLETE)
│   └── module5/                 # Automation Engine (IN PROGRESS)
├── 03-features/                 # Feature-specific documentation
│   ├── healer/                  # WordPress healing system
│   ├── metrics/                 # Server metrics collection
│   ├── notifications/           # Notification rules system
│   ├── diagnosis/               # Diagnosis and error detection
│   └── [other features]         # Email, permissions, etc.
├── 04-implementation/           # Implementation tracking
│   ├── phases/                  # Phase planning and progress
│   ├── sprints/                 # Sprint completion reports
│   └── status/                  # Overall status and summaries
├── 05-fixes/                    # Bug fixes and patches
├── 06-architecture/             # Architectural decisions
├── 07-testing/                  # Testing documentation
└── 08-guides/                   # User and developer guides
```

---

## 🚀 Quick Start

### New to the Project?
1. Start with [Getting Started Guide](./01-getting-started/QUICKSTART.md)
2. Read [Setup Instructions](./01-getting-started/SETUP_INSTRUCTIONS.md)
3. Check [Current Status](./04-implementation/status/CURRENT_STATUS.md)

### Looking for Specific Information?
- **Module Documentation:** See [02-modules/](#02-modules---module-documentation)
- **Feature Details:** See [03-features/](#03-features---feature-documentation)
- **Bug Fixes:** See [05-fixes/](#05-fixes---bug-fixes-and-patches)
- **Architecture:** See [06-architecture/](#06-architecture---architectural-decisions)

---

## 📖 Detailed Directory Guide

### 01-getting-started/ - Setup & Quick Start

Essential documentation for getting the project up and running.

**Key Files:**
- `QUICKSTART.md` - Quick start guide for developers
- `SETUP_INSTRUCTIONS.md` - Detailed setup instructions
- `README.md` - Documentation overview

**When to Use:**
- First time setting up the project
- Onboarding new team members
- Quick reference for common commands

---

### 02-modules/ - Module Documentation

Comprehensive documentation for each implemented module.

#### module1/ - Authentication & Authorization ✅ COMPLETE
**Status:** 100% Complete (Backend + Frontend)

**Key Files:**
- `MODULE1_COMPLETE_IMPLEMENTATION_SUMMARY.md` - Overall summary
- `MODULE1_BACKEND_COMPLETE.md` - Backend implementation details
- `MODULE1_FRONTEND_COMPLETE.md` - Frontend implementation details
- `MODULE1_ALL_FRS_COMPLETE.md` - All 23 functional requirements
- `MODULE1_COMPLETE_TESTING_SUMMARY.md` - Testing coverage
- `MODULE1_VERIFICATION_SUMMARY.md` - Verification and validation

**Features Implemented:**
- JWT authentication with RS256
- Multi-factor authentication (TOTP)
- Role-based access control (RBAC)
- Session management with Redis
- Password reset flow
- Audit logging
- User management UI
- Settings page with MFA setup

**Tech Stack:**
- Backend: NestJS, Prisma, PostgreSQL, Redis, jose, Argon2id
- Frontend: Next.js 14, React Query, Zustand, shadcn/ui

---

#### module2/ - Server Connection Management ✅ COMPLETE
**Status:** 100% Complete (5 Sprints)

**Key Files:**
- `MODULE2_FINAL_IMPLEMENTATION_COMPLETE.md` - Final completion summary
- `MODULE2_SPRINT1_COMPLETE.md` - Core server management
- `MODULE2_SPRINT2_COMPLETE.md` - Advanced features
- `MODULE2_SPRINT3_COMPLETE.md` - Real-time metrics backend
- `MODULE2_SPRINT4_COMPLETE.md` - Real-time metrics frontend
- `MODULE2_SPRINT5_COMPLETE.md` - Final polish

**Features Implemented:**
- Server CRUD operations
- SSH connection testing
- Credential encryption (libsodium)
- Host key verification
- Privilege escalation support
- Real-time metrics collection (CPU, RAM, Disk, Network, I/O)
- BullMQ job queue for scheduled collection
- Metrics visualization with charts
- Alert thresholds and indicators
- Connection test history

**Tech Stack:**
- Backend: NestJS, ssh2, libsodium-wrappers, BullMQ, Redis
- Frontend: Recharts, React Query polling

---

#### module4/ - WordPress Auto-Healer ✅ COMPLETE
**Status:** 100% Complete (Healer System)

**Key Files:**
- `MODULE4_IMPLEMENTATION_COMPLETE.md` - Complete implementation
- `MODULE4_FRONTEND_INTEGRATION_COMPLETE.md` - Frontend integration
- `MODULE4_SPRINT1_COMPLETE.md` - Core asset model
- `MODULE4_SPRINT2_COMPLETE.md` - Discovery scanners
- `MODULE4_SPRINT3_COMPLETE.md` - Healing system
- `MODULE4_REMOVAL_COMPLETE.md` - Asset registry removal (pivoted to healer)

**Features Implemented:**
- WordPress site discovery via SSH
- Automated diagnosis system (20+ checks)
- Self-healing capabilities
- Manual diagnosis interface
- Extensive diagnosis with detailed reports
- Site-scoped healing commands
- Subdomain support
- Error log analysis
- Syntax error detection
- Theme/plugin healing
- Self-learning system

**Tech Stack:**
- Backend: NestJS, ssh2, WordPress CLI integration
- Frontend: Next.js, React Query, real-time updates

---

#### module5/ - Automation Engine 🚧 IN PROGRESS
**Status:** Partially Complete (SRE Focus)

**Key Files:**
- `MODULE5_SRE_UPDATES_SUMMARY.md` - SRE optimization updates

**Planned Features:**
- Playbook execution engine
- Server automation workflows
- Circuit breaker pattern
- Retry logic with escalation
- Integration with Module 2 (Servers)

---

### 03-features/ - Feature Documentation

Detailed documentation for specific features across modules.

#### healer/ - WordPress Healing System
**Status:** Complete with ongoing improvements

**Key Files:**
- `HEALER_EXTENSIVE_DIAGNOSIS_AND_SUBDOMAIN_IMPLEMENTATION.md`
- `HEALER_SITE_SCOPED_COMMANDS.md`
- `HEALER_SUBDOMAIN_SUPPORT.md`
- `HEALER_DISCOVERY_UX_IMPROVEMENTS.md`
- `WP_HEALER_SELF_LEARNING_SYSTEM.md`
- `WP_HEALER_SSH_INTEGRATION_COMPLETE.md`
- `WP_HEALER_OPTIMIZED_DISCOVERY.md`
- `SELF_LEARNING_IMPLEMENTATION_COMPLETE.md`
- `SYNTAX_ERROR_HEALING_SUPPORT.md`

**Features:**
- Automated WordPress site discovery
- 20+ diagnostic checks
- Self-healing for common issues
- Manual diagnosis interface
- Extensive diagnosis reports
- Site-scoped commands
- Subdomain support
- Error log analysis
- Self-learning from successful fixes

---

#### metrics/ - Server Metrics Collection
**Status:** Complete

**Key Files:**
- `METRICS_PHASE1_COMPLETE.md` - Backend metrics collection
- `METRICS_PHASE2_FRONTEND_COMPLETE.md` - Frontend visualization
- `METRICS_PHASE3_BACKEND_COMPLETE.md` - Advanced metrics
- `METRICS_UPDATE_COMPLETE.md` - Final updates
- `METRICS_TROUBLESHOOTING.md` - Common issues

**Features:**
- Real-time metrics collection (CPU, RAM, Disk, Network, I/O)
- BullMQ scheduled jobs
- Redis caching
- Alert thresholds
- 24-hour history charts
- Manual collection
- Automatic cleanup

---

#### notifications/ - Notification Rules System
**Status:** Complete

**Key Files:**
- `NOTIFICATION_RULES_COMPLETE.md` - Complete implementation
- `NOTIFICATION_RULES_IMPLEMENTATION_PROGRESS.md` - Progress tracking

**Features:**
- Event-driven notification system
- Email notifications via SMTP
- Rule-based triggers
- Template system
- SUPER_ADMIN configuration

---

#### diagnosis/ - Diagnosis System
**Status:** Complete

**Key Files:**
- `MANUAL_DIAGNOSIS_COMPLETE.md` - Manual diagnosis system
- `MANUAL_DIAGNOSIS_BACKEND_COMPLETE.md` - Backend implementation
- `MANUAL_DIAGNOSIS_FRONTEND_COMPLETE.md` - Frontend UI
- `MANUAL_DIAGNOSIS_READY.md` - Readiness checklist
- `IMPROVED_ERROR_DIAGNOSIS.md` - Error detection improvements
- `ERROR_LOG_ANALYSIS_IMPLEMENTATION.md` - Log analysis
- `EDITABLE_DIAGNOSIS_COMMANDS.md` - Command customization

**Features:**
- Manual diagnosis triggers
- Automated diagnosis scheduling
- 20+ diagnostic checks
- Error log parsing
- Syntax error detection
- Detailed diagnosis reports
- Editable diagnosis commands

---

### 04-implementation/ - Implementation Tracking

Track project progress, phases, and sprints.

#### phases/ - Phase Planning
**Key Files:**
- `PHASE1_UNIFIED_DIAGNOSIS_IMPLEMENTATION.md`
- `PHASE2_COMPLETE.md`
- `PHASE2_COMPLETION_GUIDE.md`
- `PHASE2_ENHANCED_DIAGNOSIS_CHECKS.md`
- `PHASE2_PROGRESS.md`
- `PHASE3_PLAN.md`
- `HEALER_EXTENSIVE_DIAGNOSIS_PLAN.md`

#### status/ - Overall Status
**Key Files:**
- `CURRENT_STATUS.md` - Current project status
- `IMPLEMENTATION_PROGRESS.md` - Overall progress
- `COMPLETE_IMPLEMENTATION_STATUS.md` - Completion tracking
- `FINAL_STATUS_SUMMARY.md` - Final status
- `IMPLEMENTATION_SUMMARY.md` - Implementation summary
- `PLAN_UPDATES_COMPLETE_SUMMARY.md` - Plan updates

---

### 05-fixes/ - Bug Fixes and Patches

Documentation of all bug fixes and patches applied.

**Categories:**
- Authentication fixes
- Healer fixes
- Metrics fixes
- Database fixes
- Frontend fixes
- Backend fixes

**Key Files:**
- `CRITICAL_AUTH_FIXES.md` - Critical authentication fixes
- `HEALER_FIXES_COMPLETE.md` - All healer fixes
- `AUDIT_LOG_FOREIGN_KEY_FIX.md` - Database foreign key fix
- `LOGOUT_REFRESH_FIX.md` - Token rotation fix
- `SMTP_RELAY_ERROR_FIX.md` - Email service fix
- `DEPENDENCIES_TAB_FIX_COMPLETE.md` - UI fix
- And many more...

---

### 06-architecture/ - Architectural Decisions

High-level architectural documentation and design decisions.

**Key Files:**
- `ARCHITECTURAL_OPTIMIZATIONS.md` - System-wide optimizations
- `PLAN_UPDATES_SSE_ARCHITECTURE.md` - SSE architecture integration
- `PROJECT_ORGANIZATION.md` - Project structure

**Topics Covered:**
- Real-time updates strategy
- Scalability considerations
- Performance optimizations
- Security architecture
- Database design patterns

---

### 07-testing/ - Testing Documentation

Testing strategies, test data, and coverage reports.

**Key Files:**
- `TEST_CREDENTIALS.md` - Test user credentials
- `TEST_USERS_AND_FIXES.md` - Test user setup
- `TEST_METRICS_COLLECTION.md` - Metrics testing

**Coverage:**
- Unit tests
- Integration tests
- E2E tests
- Manual testing procedures

---

### 08-guides/ - User & Developer Guides

Practical guides for using and developing the system.

**Key Files:**
- `START_FRONTEND.md` - Frontend startup guide
- `WP_HEALER_TROUBLESHOOTING.md` - Healer troubleshooting

**Topics:**
- Development workflow
- Troubleshooting common issues
- Best practices
- Deployment guides

---

## 🔍 Finding Information

### By Module
- **Module 1 (Auth):** `02-modules/module1/`
- **Module 2 (Servers):** `02-modules/module2/`
- **Module 4 (Healer):** `02-modules/module4/` + `03-features/healer/`
- **Module 5 (Automation):** `02-modules/module5/`

### By Feature
- **Metrics:** `03-features/metrics/`
- **Notifications:** `03-features/notifications/`
- **Diagnosis:** `03-features/diagnosis/`
- **Healer:** `03-features/healer/`

### By Status
- **Current Status:** `04-implementation/status/CURRENT_STATUS.md`
- **Phase Progress:** `04-implementation/phases/`
- **Sprint Completion:** `02-modules/module*/MODULE*_SPRINT*_COMPLETE.md`

### By Issue Type
- **Bug Fixes:** `05-fixes/`
- **Architecture:** `06-architecture/`
- **Testing:** `07-testing/`

---

## 📊 Project Status Summary

### Completed Modules ✅
1. **Module 1:** Authentication & Authorization (100%)
2. **Module 2:** Server Connection Management (100%)
3. **Module 4:** WordPress Auto-Healer (100%)

### In Progress 🚧
4. **Module 5:** Automation Engine (Partially Complete)

### Planned 📋
5. **Module 6:** Incident Management
6. **Module 7:** Logging & Event Store
7. **Module 8:** Notification & Communication Bus
8. **Module 9:** Admin Control Panel

---

## 🛠️ Tech Stack

### Backend
- **Framework:** NestJS 10+
- **Language:** TypeScript 5+
- **Database:** PostgreSQL 16 with Prisma ORM
- **Cache:** Redis 7
- **Queue:** BullMQ
- **Authentication:** jose (JWT), Argon2id (passwords)
- **Encryption:** libsodium-wrappers
- **SSH:** ssh2
- **Email:** Nodemailer

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5+
- **State:** React Query (server), Zustand (client)
- **UI:** shadcn/ui, Tailwind CSS
- **Charts:** Recharts
- **Icons:** Lucide React
- **Forms:** React Hook Form + Zod

---

## 📝 Documentation Standards

All documentation follows these standards:

1. **Markdown Format** - All files use `.md` extension
2. **Clear Titles** - Descriptive titles with status indicators
3. **Date Stamps** - Creation/update dates included
4. **Status Indicators** - ✅ Complete, 🚧 In Progress, 📋 Planned
5. **Cross-References** - Links to related documents
6. **Code Examples** - Practical code snippets
7. **Screenshots** - Visual documentation where helpful

---

## 🔄 Maintenance

### Adding New Documentation

1. **Module Documentation:** Place in `02-modules/module{N}/`
2. **Feature Documentation:** Place in `03-features/{feature-name}/`
3. **Implementation Tracking:** Place in `04-implementation/`
4. **Bug Fixes:** Place in `05-fixes/`
5. **Architecture:** Place in `06-architecture/`
6. **Testing:** Place in `07-testing/`
7. **Guides:** Place in `08-guides/`

### Updating This README

When adding new sections or major documentation:
1. Update the directory structure diagram
2. Add to the appropriate category section
3. Update the project status summary
4. Add cross-references as needed

---

## 📞 Support

For questions or issues:
1. Check relevant documentation section
2. Review troubleshooting guides in `08-guides/`
3. Check bug fixes in `05-fixes/`
4. Consult architecture docs in `06-architecture/`

---

## 🎯 Next Steps

### For New Developers
1. Read [Getting Started](./01-getting-started/QUICKSTART.md)
2. Review [Module 1 Documentation](./02-modules/module1/)
3. Check [Current Status](./04-implementation/status/CURRENT_STATUS.md)
4. Explore [Architecture](./06-architecture/)

### For Existing Developers
1. Check [Current Status](./04-implementation/status/CURRENT_STATUS.md)
2. Review latest [Fixes](./05-fixes/)
3. Check [Phase Progress](./04-implementation/phases/)
4. Review module-specific updates

---

**Documentation Version:** 2.0  
**Last Major Update:** February 18, 2026  
**Maintained By:** Development Team
