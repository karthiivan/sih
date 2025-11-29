# Vercel Deployment - Step by Step Guide

## ⚠️ Important Note About This Project

This project uses **Socket.IO for real-time updates**, which **does NOT work on Vercel's serverless functions**. 

**Recommended Approach:**
- Deploy **Frontend only** on Vercel
- Deploy **Backend separately** on Railway, Render, or Fly.io (free tier available)

---

## Option 1: Deploy via Vercel Dashboard (Recommended)

### Step 1: Sign Up / Login to Vercel
1. Go to https://vercel.com
2. Click "Sign Up" (or "Login" if you have an account)
3. Sign up with GitHub (recommended for easy deployment)

### Step 2: Import Your GitHub Repository
1. After logging in, click **"Add New..."** → **"Project"**
2. Click **"Import Git Repository"**
3. If not connected, click **"Connect GitHub Account"**
4. Find and select your repository: `karthiivan/sih`
5. Click **"Import"**

### Step 3: Configure Project Settings

#### Framework Preset
- Vercel should auto-detect: **"Other"** or **"Monorepo"**

#### Root Directory
- Leave as **`.`** (root)

#### Build Settings
**IMPORTANT:** You need to configure for monorepo structure

**Build Command:**
```bash
cd frontend && npm install && npm run build
```

**Output Directory:**
```
frontend/build
```

**Install Command:**
```bash
npm install
```

### Step 4: Environment Variables (Optional)
Click **"Environment Variables"** and add:

| Name | Value |
|------|-------|
| `NODE_ENV` | `production` |
| `REACT_APP_API_URL` | `https://your-backend-url.com` (add this later) |

### Step 5: Deploy
1. Click **"Deploy"**
2. Wait 2-3 minutes for build to complete
3. You'll get a preview URL like: `https://sih-xyz.vercel.app`

### Step 6: Deploy Backend Separately

Since Socket.IO doesn't work on Vercel, deploy backend to **Railway** or **Render**:

#### Railway (Recommended - Easier)
1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select `karthiivan/sih`
5. Click "Add variables" and set:
   - `PORT` = `5002`
6. In Settings → Set **Root Directory** to `backend-node`
7. Set **Start Command** to `npm start`
8. Deploy!
9. Copy your Railway URL (e.g., `https://your-app.railway.app`)

#### Update Frontend to Use Backend URL
1. Go back to Vercel Dashboard
2. Go to your project → Settings → Environment Variables
3. Add/Update:
   - `REACT_APP_API_URL` = `https://your-app.railway.app`
4. Redeploy from Deployments tab

---

## Option 2: Deploy via Vercel CLI

### Step 1: Install Vercel CLI (if not installed)
```bash
npm install -g vercel@latest
```

### Step 2: Login to Vercel
```bash
vercel login
```
- This opens your browser
- Login with GitHub/Email
- Authorize the CLI

### Step 3: Deploy
```bash
vercel
```

Follow the prompts:
- **Set up and deploy?** → `Y`
- **Which scope?** → Select your account
- **Link to existing project?** → `N`
- **What's your project's name?** → `groundwater-monitoring` (or press Enter)
- **In which directory is your code located?** → `.` (press Enter)
- **Want to override the settings?** → `Y`

Then configure:
- **Build Command?** → `cd frontend && npm install && npm run build`
- **Output Directory?** → `frontend/build`
- **Development Command?** → `npm start`

### Step 4: Deploy to Production
```bash
vercel --prod
```

---

## Option 3: Frontend Only Deployment (Simplest)

If you want to deploy just the frontend quickly:

### Step 1: Update vercel.json
Create a simpler config:

```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/build",
  "devCommand": "cd frontend && npm start",
  "installCommand": "npm install",
  "framework": null,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Step 2: Deploy via Dashboard
1. Import repository on Vercel
2. Set Root Directory to `frontend`
3. Framework Preset: `Create React App`
4. Deploy!

---

## Troubleshooting

### Build Fails
**Error:** "Command failed: cd frontend && npm install"

**Fix:**
1. Go to Project Settings → General
2. Set **Root Directory** to `frontend`
3. Set **Build Command** to `npm run build`
4. Set **Output Directory** to `build`
5. Redeploy

### API Calls Fail
**Error:** "Failed to fetch" or CORS errors

**Fix:**
1. Deploy backend separately (Railway/Render)
2. Add environment variable in Vercel:
   - `REACT_APP_API_URL` = your backend URL
3. Update backend CORS to allow Vercel domain

### Socket.IO Not Working
**This is expected!** Vercel doesn't support WebSocket connections.

**Solutions:**
- Deploy backend on Railway/Render/Fly.io
- Or switch to HTTP polling instead of Socket.IO
- Or use Vercel Edge Functions (advanced)

---

## Post-Deployment Checklist

✅ Frontend deployed and accessible  
✅ Backend deployed separately (if using real-time features)  
✅ Environment variables configured  
✅ CORS configured on backend  
✅ Custom domain added (optional)  

---

## Quick Links

- Vercel Dashboard: https://vercel.com/dashboard
- Railway: https://railway.app
- Render: https://render.com
- Your GitHub Repo: https://github.com/karthiivan/sih

---

## Need Help?

If you encounter issues:
1. Check Vercel build logs in the dashboard
2. Check browser console for frontend errors
3. Check backend logs on Railway/Render
4. Verify environment variables are set correctly
