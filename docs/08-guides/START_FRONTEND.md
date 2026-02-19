# Start Frontend Server

## Quick Start

```bash
cd frontend
npm run dev
```

The frontend will be available at: **http://localhost:3000**

## What to Expect

1. Login page will appear first
2. After login, you'll see the dashboard
3. Look for **"WP Auto-Healer"** in the left sidebar (under Infrastructure section)
4. Click it to access the WordPress Auto-Healer

## Default Login Credentials

From the backend seed:
- **Email**: admin@opsmanager.local
- **Username**: admin
- **Password**: hv+keOpFsSUWNbkP

(You'll be prompted to change the password on first login)

## Troubleshooting

### Port Already in Use
If port 3000 is already in use:
```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

### TypeScript Errors
If you see TypeScript errors:
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
npm install

# Try again
npm run dev
```

### "WP Auto-Healer" Not Showing
1. Make sure the frontend server is running
2. Hard refresh the browser (Ctrl+Shift+R or Cmd+Shift+R)
3. Clear browser cache
4. Check browser console for errors (F12)

## Backend Must Be Running

The frontend needs the backend API to work. Make sure backend is running:

```bash
# In another terminal
cd backend
npm run start:dev
```

Backend will be available at: **http://localhost:3001**

## Verify Everything Works

1. **Backend**: http://localhost:3001/api/v1/health (should return OK)
2. **Frontend**: http://localhost:3000 (should show login page)
3. **After Login**: Click "WP Auto-Healer" in sidebar

## Next Steps

Once you see the WP Auto-Healer page:

1. **Add a Server** (if you haven't already)
   - Go to "Servers" in sidebar
   - Click "Add Server"
   - Enter server details with SSH credentials

2. **Discover WordPress Sites**
   - Go to "WP Auto-Healer"
   - Click "Discover Sites" button
   - Select your server
   - Wait for scan to complete

3. **Diagnose a Site**
   - Click "Diagnose" on any site
   - Review diagnosis results
   - Click "Fix Now" to heal

## Files Created

All healer files are in:
- `frontend/app/(dashboard)/healer/` - Pages
- `frontend/components/healer/` - Components

## Recent Changes

- ✅ Added "WP Auto-Healer" to sidebar navigation
- ✅ Added healer view to main dashboard router
- ✅ Added healer titles to header component
- ✅ Fixed TypeScript errors in diagnose page
- ✅ Created all 8 healer files (2 pages, 6 components)

Everything is ready! Just start the frontend server.
