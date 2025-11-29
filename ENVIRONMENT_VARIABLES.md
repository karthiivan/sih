# Environment Variables Guide

## Summary

**Good news!** This project works **WITHOUT any required environment variables** for basic deployment.

## Optional Environment Variables

### Frontend (Vercel)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REACT_APP_API_URL` | ❌ No | `http://localhost:5002` | Backend API URL |

**When to set:**
- Only if deploying backend separately (Railway, Render, etc.)
- Leave empty for local development

### Backend (Railway/Render)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | ❌ No | `5002` | Server port (auto-set by hosting platforms) |

**When to set:**
- Most platforms (Railway, Render) set `PORT` automatically
- No need to manually configure

## Deployment Scenarios

### Scenario 1: Frontend Only on Vercel (Testing)
**Environment Variables Needed:** ❌ NONE

The frontend will try to connect to `http://localhost:5002` which won't work in production, but you can see the UI.

### Scenario 2: Frontend on Vercel + Backend on Railway
**Frontend (Vercel):**
- `REACT_APP_API_URL` = `https://your-app.railway.app`

**Backend (Railway):**
- No variables needed (Railway sets PORT automatically)

### Scenario 3: Both on Same Platform (Not Recommended for Vercel)
**Not possible** - Vercel doesn't support Socket.IO for backend

## How to Set Environment Variables

### On Vercel Dashboard
1. Go to your project
2. Settings → Environment Variables
3. Add variable:
   - Name: `REACT_APP_API_URL`
   - Value: `https://your-backend-url.com`
4. Select environments: Production, Preview, Development
5. Save
6. Redeploy from Deployments tab

### On Railway
1. Go to your project
2. Click "Variables" tab
3. Add variable (usually not needed, PORT is auto-set)
4. Redeploy

### On Render
1. Go to your service
2. Environment → Environment Variables
3. Add variable
4. Save (auto-redeploys)

## Quick Start (No Variables Needed)

### For Local Development:
```bash
# Backend
cd backend-node
npm install
npm start

# Frontend (new terminal)
cd frontend
npm install
npm start
```

No `.env` files needed! Everything uses defaults.

### For Production:
1. Deploy frontend to Vercel (no variables)
2. Deploy backend to Railway (no variables)
3. Add `REACT_APP_API_URL` to Vercel pointing to Railway URL
4. Done!

## Testing Without Backend

If you just want to deploy the frontend to see the UI:
1. Deploy to Vercel (no variables)
2. The app will load but API calls will fail
3. You'll see the interface but no data

This is useful for:
- UI/UX testing
- Design reviews
- Frontend-only demos

## Common Questions

**Q: Do I need a `.env` file?**
A: No, not required. The app works with defaults.

**Q: What if I don't set REACT_APP_API_URL?**
A: Frontend will use `http://localhost:5002` which won't work in production.

**Q: Can I use the same backend URL for development and production?**
A: Yes, but not recommended. Use localhost for dev, production URL for prod.

**Q: Do I need API keys for external services?**
A: No, the app uses free public APIs (OpenStreetMap, Open-Meteo) that don't require keys.

## Summary

✅ **Zero environment variables required for local development**  
✅ **One optional variable for production (REACT_APP_API_URL)**  
✅ **No API keys needed**  
✅ **No database credentials needed (uses in-memory storage)**  

This makes deployment super simple!
