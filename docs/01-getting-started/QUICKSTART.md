# OpsManager Quick Start Guide

## Prerequisites

- Node.js 20+
- PostgreSQL 16
- Redis 7
- pnpm (package manager)
- Docker & Docker Compose (recommended)

---

## Quick Start (5 minutes)

### 1. Start Infrastructure
```bash
# Start PostgreSQL, Redis, and MailHog
docker-compose up -d
```

### 2. Setup Backend
```bash
cd backend

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env

# Generate encryption key and add to .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Setup database
pnpm prisma generate
pnpm prisma migrate dev --name init
pnpm prisma db seed

# Start backend
pnpm run start:dev
```

**Important:** Save the admin credentials shown in the console!

### 3. Setup Frontend
```bash
cd frontend

# Install dependencies (includes zustand)
pnpm install

# Environment is already configured in .env.local

# Start frontend
pnpm run dev
```

### 4. Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001/api/v1
- **API Docs:** http://localhost:3001/api/docs
- **MailHog:** http://localhost:8025

### 5. Login

1. Navigate to http://localhost:3000
2. You'll be redirected to /login
3. Use the admin credentials from step 2
4. Explore the dashboard!

---

## What's Available

### Authentication
- ✅ Login with MFA support
- ✅ Password reset flow
- ✅ Session management
- ✅ JWT authentication

### User Management
- ✅ Create/edit/delete users
- ✅ Activate/deactivate accounts
- ✅ Unlock accounts
- ✅ Role assignment

### Security
- ✅ Audit logs viewer
- ✅ Active sessions management
- ✅ MFA setup (backend ready)
- ✅ Password policies

### Dashboard
- ✅ Overview (placeholder)
- ✅ Servers (placeholder)
- ✅ Users (fully functional)
- ✅ Audit Logs (fully functional)
- ✅ Sessions (fully functional)

---

## Testing

### Test User Creation
1. Login as admin
2. Go to "Users" in sidebar
3. Click "Create User"
4. Fill in details and save
5. Note the temporary password

### Test Password Reset
1. Logout
2. Click "Forgot password?"
3. Enter email
4. Check MailHog for reset email
5. Click link and set new password

### Test Session Management
1. Login from multiple browsers
2. Go to "Sessions"
3. View all active sessions
4. Revoke a session

### Test Audit Logs
1. Perform various actions
2. Go to "Audit Logs"
3. View logged actions
4. Test filters

---

## Troubleshooting

### Backend won't start
- Check PostgreSQL is running: `docker ps`
- Check Redis is running: `docker ps`
- Verify .env file has all required variables
- Check database connection: `pnpm prisma studio`

### Frontend won't start
- Check backend is running: http://localhost:3001/api/v1
- Verify .env.local has correct API URL
- Clear node_modules and reinstall: `rm -rf node_modules && pnpm install`

### Can't login
- Verify backend is running
- Check admin credentials from seed output
- Check browser console for errors
- Verify API URL in .env.local

### Database errors
- Reset database: `pnpm prisma migrate reset`
- Re-run seed: `pnpm prisma db seed`

---

## Next Steps

1. **Explore the codebase:**
   - Backend: `backend/src/modules/`
   - Frontend: `frontend/app/` and `frontend/components/`

2. **Read the documentation:**
   - `MODULE1_BACKEND_COMPLETE.md` - Backend details
   - `MODULE1_FRONTEND_IMPLEMENTATION.md` - Frontend details
   - `plan/1. Auth + RBAC + Sessions + MFA (foundation for everything).md` - Original plan

3. **Start Module 2:**
   - Server Connection Management
   - SSH integration
   - Credential encryption

---

## Support

For issues or questions:
1. Check the documentation files
2. Review the plan documents in `plan/`
3. Check Swagger docs: http://localhost:3001/api/docs

---

**Happy coding! 🚀**
