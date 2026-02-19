# WP Auto-Healer Not Showing - Troubleshooting Guide

## 🔴 ROOT CAUSE IDENTIFIED

**The frontend development server is NOT running!**

Your backend is running on port 3001, but the frontend (Next.js) is not running on port 3000.

## ✅ What's Already Done

All code is complete and correct:

1. ✅ Backend Module 4 (WP Auto-Healer) - 100% complete
2. ✅ Database migration - Applied successfully
3. ✅ Frontend pages created in correct location:
   - `frontend/app/(dashboard)/healer/page.tsx`
   - `frontend/app/(dashboard)/healer/sites/[id]/diagnose/page.tsx`
4. ✅ Frontend components created (6 components):
   - `frontend/components/healer/SiteList.tsx`
   - `frontend/components/healer/SiteCard.tsx`
   - `frontend/components/healer/DiagnosisPanel.tsx`
   - `frontend/components/healer/HealingProgress.tsx`
   - `frontend/components/healer/ExecutionLogs.tsx`
   - `frontend/components/healer/DiscoverSitesModal.tsx`
5. ✅ Sidebar navigation updated with "WP Auto-Healer" link
6. ✅ Main dashboard router updated with healer view
7. ✅ Header component updated with healer titles
8. ✅ All TypeScript errors fixed (0 errors)

## 🚀 SOLUTION: Start the Frontend Server

### Step 1: Open a New Terminal

Open a new terminal window/tab (keep your backend terminal running).

### Step 2: Navigate to Frontend Directory

```bash
cd /home/abdullah/StudioProjects/final_CP/frontend
```

### Step 3: Start the Development Server

```bash
npm run dev
```

You should see output like:
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
- Ready in X.Xs
```

### Step 4: Open Browser

Navigate to: **http://localhost:3000**

### Step 5: Login

Use these credentials:
- **Email**: admin@opsmanager.local
- **Password**: hv+keOpFsSUWNbkP

### Step 6: Find WP Auto-Healer

After login, look in the left sidebar under "Infrastructure" section. You'll see:
- Overview
- Servers
- Network
- Databases
- Monitoring
- Firewall
- Integrations
- **WP Auto-Healer** ← Click this!

## 🔍 Verification Checklist

Before starting frontend, verify:

- [x] Backend is running on port 3001
  ```bash
  curl http://localhost:3001/api/v1/health
  # Should return: {"status":"ok"}
  ```

- [ ] Frontend is running on port 3000
  ```bash
  lsof -i :3000
  # Should show node process
  ```

- [ ] Can access login page
  ```bash
  curl http://localhost:3000
  # Should return HTML
  ```

## 🐛 Common Issues

### Issue 1: Port 3000 Already in Use

**Error**: `Port 3000 is already in use`

**Solution**:
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### Issue 2: Module Not Found Errors

**Error**: `Cannot find module '@/components/...'`

**Solution**:
```bash
# Reinstall dependencies
rm -rf node_modules
npm install

# Clear Next.js cache
rm -rf .next

# Try again
npm run dev
```

### Issue 3: TypeScript Errors

**Error**: TypeScript compilation errors

**Solution**:
```bash
# Check for errors
npm run build

# If errors exist, check diagnostics
npx tsc --noEmit
```

### Issue 4: "WP Auto-Healer" Still Not Showing

**After starting frontend**, if you still don't see it:

1. **Hard refresh browser**: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
2. **Clear browser cache**: F12 → Application → Clear Storage
3. **Check browser console**: F12 → Console (look for errors)
4. **Verify sidebar code**: Check `frontend/components/dashboard/sidebar.tsx` line 42-43

## 📊 Current System Status

### Backend ✅
- **Status**: Running
- **Port**: 3001
- **Process ID**: 244174
- **Health**: http://localhost:3001/api/v1/health

### Frontend ❌
- **Status**: NOT RUNNING
- **Port**: 3000 (should be)
- **Action Required**: Start with `npm run dev`

### Database ✅
- **Status**: Running
- **Migration**: Applied (20260214073210_add_healer_module)
- **Tables**: WpSite, HealerExecution, HealerBackup

## 🎯 Expected Result

After starting frontend and logging in, you should see:

```
┌─────────────────────────────────────────────────────────┐
│ Sidebar                                                 │
├─────────────────────────────────────────────────────────┤
│ INFRASTRUCTURE                                          │
│ ☐ Overview                                              │
│ ☐ Servers                                               │
│ ☐ Network                                               │
│ ☐ Databases                                             │
│ ☐ Monitoring                                            │
│ ☐ Firewall                                              │
│ ☐ Integrations                                          │
│ 🔧 WP Auto-Healer  ← THIS IS WHAT YOU'RE LOOKING FOR   │
│                                                         │
│ ACCOUNT                                                 │
│ ☐ Users                                                 │
│ ☐ Audit Logs                                            │
│ ☐ Sessions                                              │
│ ☐ Notifications                                         │
│ ☐ Billing                                               │
│ ☐ Settings                                              │
└─────────────────────────────────────────────────────────┘
```

## 📝 Quick Command Reference

```bash
# Start backend (if not running)
cd /home/abdullah/StudioProjects/final_CP/backend
npm run start:dev

# Start frontend (in new terminal)
cd /home/abdullah/StudioProjects/final_CP/frontend
npm run dev

# Check backend health
curl http://localhost:3001/api/v1/health

# Check frontend (after starting)
curl http://localhost:3000

# Check running processes
ps aux | grep -E "(node|npm)" | grep -v grep

# Check ports
lsof -i :3000  # Frontend
lsof -i :3001  # Backend
```

## 🎉 Success Indicators

You'll know it's working when:

1. ✅ Frontend terminal shows "Ready in X.Xs"
2. ✅ Browser shows login page at http://localhost:3000
3. ✅ After login, dashboard loads
4. ✅ Sidebar shows "WP Auto-Healer" with wrench icon (🔧)
5. ✅ Clicking "WP Auto-Healer" shows the healer page with "Discover Sites" button

## 🔗 Related Files

- Backend API: `backend/src/modules/healer/`
- Frontend Pages: `frontend/app/(dashboard)/healer/`
- Frontend Components: `frontend/components/healer/`
- Sidebar Navigation: `frontend/components/dashboard/sidebar.tsx`
- Main Router: `frontend/app/page.tsx`
- Startup Guide: `START_FRONTEND.md`

## 📞 Next Steps After Frontend Starts

1. **Login** with admin credentials
2. **Add a Server** (if you haven't already)
   - Go to "Servers" → "Add Server"
   - Enter SSH credentials for a server with WordPress sites
3. **Discover Sites**
   - Go to "WP Auto-Healer"
   - Click "Discover Sites"
   - Select your server
   - Wait for scan
4. **Diagnose & Heal**
   - Click "Diagnose" on any site
   - Review issues found
   - Click "Fix Now" to auto-heal

---

**Last Updated**: February 14, 2026
**Status**: Ready to start frontend server
