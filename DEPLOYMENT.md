# Vercel Deployment Guide

## Prerequisites
- Vercel CLI installed ✓
- Git repository initialized
- Vercel account (sign up at vercel.com)

## Deployment Steps

### 1. Login to Vercel
```bash
vercel login
```

### 2. Deploy to Vercel
```bash
vercel
```

Follow the prompts:
- Set up and deploy? **Y**
- Which scope? Select your account
- Link to existing project? **N** (first time)
- Project name? Press enter or type a name
- In which directory is your code located? **.**
- Want to override settings? **N**

### 3. Deploy to Production
```bash
vercel --prod
```

## Environment Variables (Optional)

If you need to set environment variables:

```bash
vercel env add PORT
# Enter value: 5002

vercel env add NODE_ENV
# Enter value: production
```

## Post-Deployment

After deployment, Vercel will provide:
- Preview URL (for testing)
- Production URL (after `vercel --prod`)

Update your frontend to use the production API URL if needed.

## Troubleshooting

### Socket.IO Issues
Vercel serverless functions have limitations with WebSocket connections. Consider:
- Using Vercel's Edge Functions
- Deploying backend separately (Railway, Render, etc.)
- Using polling instead of WebSocket for real-time updates

### Build Errors
Check build logs:
```bash
vercel logs
```

## Alternative: Deploy via Git

1. Push to GitHub/GitLab/Bitbucket
2. Import project in Vercel dashboard
3. Vercel will auto-deploy on every push
