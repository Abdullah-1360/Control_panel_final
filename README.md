# OpsManager - Infrastructure Management Platform

**Enterprise-grade infrastructure management and automation platform**

---

## 🚀 Quick Start

**New to the project?** Start here:

1. 📖 **[Documentation Entry Point](./docs/00-START-HERE.md)** - Your guide to all documentation
2. 🏃 **[Quick Start Guide](./docs/01-getting-started/QUICKSTART.md)** - Get up and running fast
3. 📊 **[Current Status](./docs/04-implementation/status/CURRENT_STATUS.md)** - See what's complete

---

## 📚 Documentation

All project documentation is organized in the `docs/` directory:

```
docs/
├── 00-START-HERE.md           # 👈 Start here for navigation
├── README.md                   # Complete documentation index
├── STRUCTURE.md                # Visual structure guide
│
├── 01-getting-started/         # Setup and quick start
├── 02-modules/                 # Module documentation (4 modules)
├── 03-features/                # Feature documentation (6 features)
├── 04-implementation/          # Progress tracking
├── 05-fixes/                   # Bug fixes (24 documented)
├── 06-architecture/            # Architectural decisions
├── 07-testing/                 # Testing documentation
└── 08-guides/                  # User and developer guides
```

**Total:** 152 documentation files across 8 categories

### Quick Links
- 📖 [Full Documentation Index](./docs/README.md)
- 🗂️ [Documentation Structure](./docs/STRUCTURE.md)
- 🏁 [Getting Started](./docs/01-getting-started/)
- 📦 [Module Documentation](./docs/02-modules/)
- 🎯 [Feature Documentation](./docs/03-features/)

---

## 📊 Project Status

### Completed Modules ✅
1. **Module 1:** Authentication & Authorization (100%)
2. **Module 2:** Server Connection Management (100%)
3. **Module 4:** WordPress Auto-Healer (100%)

### In Progress 🚧
4. **Module 5:** Automation Engine (30%)

### Planned 📋
5. Module 6: Incident Management
6. Module 7: Logging & Event Store
7. Module 8: Notification & Communication
8. Module 9: Admin Control Panel

**Overall Progress:** 3 of 9 modules complete (33%)

---

## 🎯 Key Features

### ✅ Implemented
- **Authentication & Authorization** - JWT, MFA, RBAC, session management
- **Server Management** - SSH connections, credential encryption, metrics
- **WordPress Healing** - Auto-discovery, diagnosis, self-healing
- **Real-Time Metrics** - CPU, RAM, Disk, Network, I/O monitoring
- **Notification Rules** - Event-driven email notifications
- **Diagnosis System** - 20+ diagnostic checks for WordPress sites

### 🚧 In Progress
- **Automation Engine** - Server automation and workflow execution

### 📋 Planned
- **Incident Management** - Incident tracking and response
- **Logging & Event Store** - Centralized logging
- **Admin Control Panel** - Comprehensive admin UI

---

## 🛠️ Tech Stack

### Backend
- **Framework:** NestJS 10+
- **Language:** TypeScript 5+
- **Database:** PostgreSQL 16 + Prisma ORM
- **Cache:** Redis 7
- **Queue:** BullMQ
- **Auth:** jose (JWT), Argon2id (passwords)
- **Encryption:** libsodium-wrappers
- **SSH:** ssh2

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5+
- **State:** React Query + Zustand
- **UI:** shadcn/ui + Tailwind CSS
- **Charts:** Recharts
- **Forms:** React Hook Form + Zod

---

## 🏗️ Project Structure

```
.
├── backend/                    # NestJS backend application
├── frontend/                   # Next.js frontend application
├── docs/                       # 📚 All documentation (152 files)
├── plan/                       # Implementation plans
├── .kiro/                      # Kiro AI configuration
├── docker-compose.yml          # Infrastructure services
└── README.md                   # This file
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 16
- Redis 7
- Docker & Docker Compose
- pnpm

### Quick Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd final_CP

# 2. Start infrastructure services
docker-compose up -d

# 3. Setup backend
cd backend
pnpm install
pnpm prisma generate
pnpm prisma migrate dev
pnpm run start:dev

# 4. Setup frontend (in another terminal)
cd frontend
pnpm install
pnpm run dev
```

### Access URLs
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001/api/v1
- **API Docs:** http://localhost:3001/api/docs
- **MailHog:** http://localhost:8025

For detailed setup instructions, see [Setup Guide](./docs/01-getting-started/SETUP_INSTRUCTIONS.md).

---

## 📖 Documentation Highlights

### For Developers
- [Quick Start Guide](./docs/01-getting-started/QUICKSTART.md)
- [Module 1: Authentication](./docs/02-modules/module1/)
- [Module 2: Servers](./docs/02-modules/module2/)
- [Module 4: Healer](./docs/02-modules/module4/)
- [Architecture Docs](./docs/06-architecture/)

### For Project Managers
- [Current Status](./docs/04-implementation/status/CURRENT_STATUS.md)
- [Implementation Progress](./docs/04-implementation/status/IMPLEMENTATION_PROGRESS.md)
- [Module Overview](./docs/02-modules/README.md)
- [Phase Planning](./docs/04-implementation/phases/)

### For Users
- [Getting Started](./docs/01-getting-started/)
- [User Guides](./docs/08-guides/)
- [Troubleshooting](./docs/08-guides/WP_HEALER_TROUBLESHOOTING.md)

---

## 🔧 Development

### Running Tests
```bash
# Backend tests
cd backend
pnpm test                # Unit tests
pnpm test:e2e           # E2E tests

# Frontend tests
cd frontend
pnpm test               # Unit tests
```

### Code Quality
```bash
# Linting
pnpm run lint

# Type checking
pnpm run type-check

# Formatting
pnpm run format
```

---

## 📝 Contributing

1. Read the [Documentation](./docs/README.md)
2. Check [Current Status](./docs/04-implementation/status/CURRENT_STATUS.md)
3. Review [Architecture](./docs/06-architecture/)
4. Follow coding standards in [Tech Stack Guide](./docs/.kiro/steering/tech-stack.md)

---

## 📄 License

[Add your license here]

---

## 🤝 Support

For questions or issues:
1. Check [Documentation](./docs/00-START-HERE.md)
2. Review [Troubleshooting Guides](./docs/08-guides/)
3. Check [Bug Fixes](./docs/05-fixes/)
4. Review [Testing Docs](./docs/07-testing/)

---

## 🎯 Roadmap

### Phase 1: Foundation ✅ Complete
- Module 1: Authentication & Authorization

### Phase 2: Infrastructure ✅ Complete
- Module 2: Server Connection Management

### Phase 3: Operations 🚧 In Progress
- Module 4: WordPress Auto-Healer ✅
- Module 5: Automation Engine 🚧

### Phase 4: Monitoring & Communication 📋 Planned
- Module 6: Incident Management
- Module 7: Logging & Event Store
- Module 8: Notification & Communication

### Phase 5: Administration 📋 Planned
- Module 9: Admin Control Panel

---

## 📊 Statistics

- **Modules Complete:** 3 of 9 (33%)
- **Features Implemented:** 6 (Healer, Metrics, Notifications, Diagnosis, Email, Permissions)
- **Bug Fixes Applied:** 24 documented fixes
- **Documentation Files:** 152 files
- **Lines of Code:** [Add LOC count]
- **Test Coverage:** [Add coverage %]

---

## 🌟 Highlights

- ✅ **Production-Ready Modules:** 3 complete modules with full documentation
- ✅ **Comprehensive Documentation:** 152 files across 8 categories
- ✅ **Modern Tech Stack:** NestJS, Next.js, PostgreSQL, Redis
- ✅ **Security First:** JWT, MFA, RBAC, encryption, audit logging
- ✅ **Real-Time Features:** Metrics, notifications, live updates
- ✅ **Self-Healing:** Automated WordPress diagnosis and healing

---

**Last Updated:** February 18, 2026  
**Version:** 0.3.0 (3 modules complete)  
**Status:** Active Development

---

**Ready to get started?** Head to [docs/00-START-HERE.md](./docs/00-START-HERE.md) 🚀
