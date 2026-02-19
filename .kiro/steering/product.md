---
inclusion: always
---

# OpsManager Product Context

## Product Vision
"A unified, intelligent operations platform that empowers IT teams to manage, monitor, automate, and secure their entire infrastructure with confidence and efficiency."

## Product Overview
OpsManager is an enterprise-grade infrastructure management and automation platform designed to provide unified control over servers, applications, incidents, and operational workflows.

## Core Value Propositions
- Reduce MTTR by 60% through automated incident response
- Improve Infrastructure Visibility with unified asset registry
- Enhance Security Posture with comprehensive audit logging and RBAC
- Scale Operations supporting 10,000+ managed assets
- Ensure Compliance with SOC 2, ISO 27001, and GDPR

## Target User Roles (RBAC)
- SUPER_ADMIN: Full system access
- ADMIN: Resource management, incident response
- MANAGER: Read access, reporting
- NOC: Incident monitoring
- ENGINEER: Server management, automation execution
- HELPDESK: Limited read access

## Core Modules (9 Total)
1. Authentication & Authorization (P0 - CRITICAL)
2. Server Connection Management (P0)
3. Integration Hub (P1)
4. Universal Asset Registry (P1)
5. Automation & Workflow Engine (P1)
6. Incident Management (P1)
7. Logging & Event Store (P0)
8. Notification & Communication Bus (P1)
9. Admin Control Panel (P0)

## Key Constraints
- NO External Automation Tools (Pure TypeScript only)
- NO OAuth/SSO in Phase 1 (JWT-only)
- NO Mobile Native Apps (Responsive web only)
- PostgreSQL Only (No multi-database support)

## Product Philosophy
- Engineer-First: Dense, information-rich interfaces
- Real-Time by Default: Live updates without page reloads
- Security Never Compromised: Encryption, audit logging, RBAC everywhere
- Automation Over Manual: Reduce human error
- Observability Built-In: Comprehensive logging from day one
