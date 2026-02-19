# Module 4: Universal Asset Registry - Sprint 1 Complete

## Sprint 1: Core Asset Model ✅

**Status:** COMPLETE  
**Date:** February 10, 2026  
**Duration:** ~2 hours  
**Test Coverage:** Pending (Sprint 1 Phase 2)

---

## Implemented Features

### 1. Database Schema (Prisma) ✅

**Models Created:**
- `Asset` - Flexible asset model with JSONB metadata
- `AssetRelation` - Relationship mapping between assets

**Asset Types Supported:**
- `SITE_WORDPRESS` - WordPress sites
- `SITE_GENERIC` - Generic web applications
- `DOMAIN` - Domain names (ready for Sprint 2)
- `SSL_CERT` - SSL certificates (ready for Sprint 2)
- `DATABASE_MYSQL` - MySQL databases (ready for Sprint 2)
- `DATABASE_POSTGRES` - PostgreSQL databases (ready for Sprint 2)

**Key Features:**
- Flexible metadata storage (JSONB)
- Encrypted secrets field (libsodium)
- Soft delete with 7-day retention
- Full-text search indexes
- Relationship support (parent/child)
- Discovery source tracking
- Health status tracking

**Enums:**
- `AssetType` - 6 asset types
- `AssetStatus` - PENDING, ACTIVE, WARNING, ERROR, SUSPENDED, ARCHIVED
- `AssetHealth` - UNKNOWN, HEALTHY, DEGRADED, DOWN
- `DiscoverySource` - MANUAL, WHM_SYNC, SSH_SCAN, INTEGRATION_SYNC
- `RelationType` - HOSTS, PROTECTS, USES, POINTS_TO, DEPENDS_ON

**Relations:**
- Asset → Server (optional)
- Asset → Integration (optional)
- Asset → User (createdBy)
- Asset → AssetRelation (parent/child)

---

### 2. DTOs (Data Transfer Objects) ✅

**Created:**
- `CreateAssetDto` - Validation for asset creation
- `UpdateAssetDto` - Validation for asset updates
- `QueryAssetsDto` - Filtering and pagination
- `CreateRelationDto` - Relationship creation

**Validation:**
- Type safety with enums
- String length constraints
- UUID validation
- Optional fields properly marked
- Swagger documentation

---

### 3. Backend Services ✅

#### AssetsService
**Methods:**
- `create()` - Create new asset with validation
- `findAll()` - List assets with filtering, pagination, search
- `findOne()` - Get asset by ID with relationships
- `update()` - Update asset with conflict checking
- `remove()` - Soft delete with dependency checking
- `getAssetWithSecrets()` - Internal method for decrypted secrets
- `upsert()` - Create or update (for scanners)

**Features:**
- Duplicate detection (type + identifier)
- Server/Integration validation
- Secrets encryption with libsodium
- Audit logging for all operations
- Sanitization (never return encrypted secrets)
- Soft delete with 7-day retention
- Force delete with dependency warning

#### RelationshipsService
**Methods:**
- `create()` - Create relationship with cycle detection
- `getRelationships()` - Get all relationships for an asset
- `getDependencyGraph()` - Recursive dependency graph (max depth 3)
- `remove()` - Delete relationship
- `wouldCreateCycle()` - Circular dependency detection (BFS)
- `buildGraph()` - Recursive graph builder

**Features:**
- Circular dependency prevention
- Self-referencing prevention
- Duplicate relationship detection
- Audit logging
- Recursive graph traversal

---

### 4. API Endpoints ✅

**Asset CRUD:**
- `POST /api/v1/assets` - Create asset
- `GET /api/v1/assets` - List assets (paginated, filtered)
- `GET /api/v1/assets/:id` - Get asset details
- `PATCH /api/v1/assets/:id` - Update asset
- `DELETE /api/v1/assets/:id` - Delete asset (soft delete)

**Relationships:**
- `POST /api/v1/assets/relationships` - Create relationship
- `GET /api/v1/assets/:id/relationships` - Get relationships
- `GET /api/v1/assets/:id/dependency-graph` - Get dependency graph
- `DELETE /api/v1/assets/relationships/:relationId` - Delete relationship

**Query Parameters (GET /api/v1/assets):**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 100)
- `sort` - Sort field (default: createdAt)
- `order` - Sort order (asc/desc, default: desc)
- `type` - Filter by asset type
- `status` - Filter by status
- `health` - Filter by health
- `serverId` - Filter by server
- `integrationId` - Filter by integration
- `search` - Full-text search (identifier, friendlyName)
- `tags` - Filter by tags (comma-separated)

---

### 5. Security & RBAC ✅

**Permissions Required:**
- `assets.create` - Create assets and relationships
- `assets.read` - View assets and relationships
- `assets.update` - Update assets
- `assets.delete` - Delete assets and relationships

**Security Features:**
- JWT authentication required
- Permission guards on all endpoints
- Secrets encrypted with libsodium (XSalsa20-Poly1305)
- Secrets never returned in API responses
- Audit logging for all operations
- Soft delete with retention policy

---

### 6. Integration Points ✅

**Module 1 (Auth):**
- JWT authentication
- RBAC permissions
- Audit logging
- User tracking (createdBy)

**Module 2 (Servers):**
- Asset → Server relationship
- Server validation
- Ready for SSH scanners (Sprint 2)

**Module 3 (Integrations):**
- Asset → Integration relationship
- Integration validation
- Ready for WHM scanner (Sprint 2)

**Encryption Service:**
- Secrets encryption/decryption
- Consistent with Module 2/3

---

## Database Migration

**Migration:** `20260210175821_add_module4_asset_registry`

**Tables Created:**
- `assets` - Main asset table
- `asset_relations` - Relationship mapping

**Indexes Created:**
- `assets.type`
- `assets.status`
- `assets.health`
- `assets.serverId`
- `assets.integrationId`
- `assets.identifier`
- `assets.discoverySource`
- `assets.deletedAt`
- `assets.createdByUserId`
- `asset_relations.parentId`
- `asset_relations.childId`
- `asset_relations.relationType`

---

## API Examples

### Create WordPress Site Asset
```bash
POST /api/v1/assets
Authorization: Bearer <token>

{
  "type": "SITE_WORDPRESS",
  "identifier": "example.com",
  "friendlyName": "Example WordPress Site",
  "serverId": "cmlf2q3id000114bdt72llz43",
  "metadata": {
    "wpVersion": "6.4.2",
    "phpVersion": "8.1",
    "path": "/var/www/example.com",
    "diskUsage": "500MB"
  },
  "secrets": {
    "dbUser": "wp_user",
    "dbPassword": "secure_password",
    "dbName": "wp_database"
  },
  "tags": ["production", "wordpress", "client-a"],
  "notes": "Main production site for Client A"
}
```

### List Assets with Filtering
```bash
GET /api/v1/assets?type=SITE_WORDPRESS&status=ACTIVE&search=example&page=1&limit=50
Authorization: Bearer <token>
```

### Create Relationship (Server HOSTS Site)
```bash
POST /api/v1/assets/relationships
Authorization: Bearer <token>

{
  "parentId": "server-uuid",
  "childId": "site-uuid",
  "relationType": "HOSTS"
}
```

### Get Dependency Graph
```bash
GET /api/v1/assets/:id/dependency-graph?maxDepth=3
Authorization: Bearer <token>
```

---

## What's Next: Sprint 2 - Discovery Scanners

### Planned Features:
1. **Scanner Framework**
   - AssetScanner interface
   - Scanner registry
   - BullMQ job scheduling

2. **WHM Scanner**
   - Integrate with Module 3 WHM adapter
   - Sync cPanel accounts → SITE_GENERIC assets
   - Extract metadata (disk usage, domains)

3. **SSH WordPress Scanner**
   - Integrate with Module 2 SSH service
   - Find wp-config.php files
   - Parse WordPress configuration
   - Detect WordPress version
   - Extract database credentials (encrypted)
   - Create SITE_WORDPRESS assets

4. **Auto-Inferred Relationships**
   - Site → Server (from serverId)
   - Site → Database (from wp-config.php)
   - Domain → Site (from DNS/config)

---

## Files Created

### Backend
- `backend/prisma/schema.prisma` - Updated with Asset models
- `backend/src/modules/assets/dto/create-asset.dto.ts`
- `backend/src/modules/assets/dto/update-asset.dto.ts`
- `backend/src/modules/assets/dto/query-assets.dto.ts`
- `backend/src/modules/assets/dto/create-relation.dto.ts`
- `backend/src/modules/assets/dto/index.ts`
- `backend/src/modules/assets/assets.service.ts`
- `backend/src/modules/assets/relationships.service.ts`
- `backend/src/modules/assets/assets.controller.ts`
- `backend/src/modules/assets/assets.module.ts`
- `backend/src/app.module.ts` - Updated to include AssetsModule

### Documentation
- `MODULE4_SPRINT1_COMPLETE.md` - This file

---

## Testing Status

**Unit Tests:** ⏳ Pending (Sprint 1 Phase 2)
**Integration Tests:** ⏳ Pending (Sprint 1 Phase 2)
**E2E Tests:** ⏳ Pending (Sprint 4)

**Next Steps:**
1. Write unit tests for AssetsService (>80% coverage)
2. Write unit tests for RelationshipsService (>80% coverage)
3. Write integration tests for API endpoints
4. Test with real data (create assets, relationships)

---

## Success Criteria

### Completed ✅
- [x] Prisma schema with Asset and AssetRelation models
- [x] Flexible metadata storage (JSONB)
- [x] Encrypted secrets field
- [x] Asset CRUD operations
- [x] Relationship management with cycle detection
- [x] API endpoints with RBAC
- [x] Audit logging
- [x] Soft delete with 7-day retention
- [x] Integration with Module 1, 2, 3
- [x] Database migration applied

### Pending ⏳
- [ ] Unit tests (>80% coverage)
- [ ] Integration tests
- [ ] API documentation (Swagger)
- [ ] Performance testing

---

## Tech Stack Alignment

✅ **Backend:**
- NestJS with TypeScript
- Prisma ORM with PostgreSQL
- class-validator for DTOs
- libsodium-wrappers for encryption
- Integration with Module 1 (Auth, Audit, Encryption)
- Integration with Module 2 (Servers)
- Integration with Module 3 (Integrations)

✅ **Database:**
- PostgreSQL 16
- JSONB for flexible metadata
- Full-text search indexes
- Proper foreign keys and cascades

✅ **Security:**
- JWT authentication
- RBAC permissions
- Secrets encryption
- Audit logging
- Soft delete

---

**Status:** Sprint 1 Core Asset Model - COMPLETE ✅  
**Next:** Sprint 2 Discovery Scanners (WHM + SSH WordPress)  
**Estimated Time:** 1-2 days

