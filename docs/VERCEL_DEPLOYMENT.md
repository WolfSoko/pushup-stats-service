# Vercel Deployment Guide

This guide explains how to deploy the **web** application (Angular SSR) to Vercel.

## Architecture Overview

The PUS project consists of three services:

1. **web** (Angular SSR) → **DEPLOYED TO VERCEL** ✅
2. **api** (NestJS) → Runs locally/Tailscale (NOT on Vercel)
3. **reverse-proxy** (Express) → Runs locally (NOT on Vercel)

**Why this architecture?**

- Vercel excels at static/SSR frontend hosting
- The API needs persistent file-based database (NeDB) → better on local server/VPS
- API is accessible via Tailscale: `https://pushups.tail433f94.ts.net`

## Prerequisites

- Vercel account (free tier works)
- GitHub repo connected to Vercel
- Node.js 22+ (specified in `package.json` engines)
- Nx workspace knowledge

## Initial Vercel Project Setup

### 1. Import Project to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import from GitHub: `WolfSoko/pushup-stats-service`
4. Configure build settings (see below)

### 2. Build Settings

In Vercel project settings:

| Setting              | Value                                         |
| -------------------- | --------------------------------------------- |
| **Framework Preset** | Other (not Angular!)                          |
| **Root Directory**   | `./` (monorepo root)                          |
| **Build Command**    | `npx nx build web --configuration=production` |
| **Output Directory** | `dist/web/browser`                            |
| **Install Command**  | `npm install`                                 |
| **Node Version**     | 22.x                                          |

⚠️ **Important**: Do NOT select "Angular" preset! We use custom Nx build commands.

### 3. Environment Variables

**None required!** 🎉

- Firebase config is injected client-side via `window.__PUS_FIREBASE__`
- API URL is proxied via `vercel.json` rewrites to Tailscale endpoint

If you need to add Firebase config in the future, use Vercel Environment Variables:

```bash
# Optional: if you want to inject Firebase config server-side
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_APP_ID=...
```

### 4. Domain Configuration

- **Production**: `pushup-stats-service.vercel.app` (or custom domain)
- **Preview**: Auto-generated for each PR

## Configuration Files

### `vercel.json`

Located at repo root:

```json
{
  "buildCommand": "npx nx build web --configuration=production",
  "outputDirectory": "dist/web/browser",
  "framework": null,
  "regions": ["fra1"],
  "functions": {
    "dist/web/server/**/*.mjs": {
      "runtime": "nodejs22.x",
      "maxDuration": 10
    }
  },
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://pushups.tail433f94.ts.net/api/:path*"
    },
    {
      "source": "/socket.io/:path*",
      "destination": "https://pushups.tail433f94.ts.net/socket.io/:path*"
    }
  ]
}
```

**Key points:**

- API requests (`/api/*`) are proxied to Tailscale backend
- WebSocket (`/socket.io/*`) is also proxied
- SSR functions use Node.js 22.x runtime
- Deployed to Frankfurt region (`fra1`) for low latency

### `.vercelignore`

Excludes unnecessary files from deployment:

```
api/
reverse-proxy/
daemons/
*.log
.env
.angular/
.nx/
node_modules/
coverage/
web-e2e/
```

## Deployment Workflow

### Production Deployment

```bash
# Automatic on merge to main
git push origin main
```

Vercel automatically:

1. Detects push to `main`
2. Runs `npm install`
3. Executes `npx nx build web --configuration=production`
4. Deploys to production URL

### Preview Deployment

```bash
# Automatic on PR creation/update
git push origin feature/my-branch
```

Every PR gets a unique preview URL like:
`pushup-stats-service-git-feature-my-branch-wolfSoko.vercel.app`

### Manual Deployment

```bash
# Install Vercel CLI (optional)
npm i -g vercel

# Deploy from local
vercel --prod
```

## Monitoring Deployments

### Check Deployment Status

1. **GitHub**: Check commit status (✅ or ❌)
2. **Vercel Dashboard**: [deployments page](https://vercel.com/wolfsoko/pushup-stats-service/deployments)
3. **Email**: Vercel sends deployment notifications

### Logs

View logs in Vercel Dashboard:

- **Build logs**: Shows `nx build` output
- **Function logs**: SSR runtime logs (errors, etc.)

### Common Issues

#### 1. Build fails: "Cannot find module 'nx'"

**Cause**: `installCommand` not set correctly

**Fix**: Ensure `npm install` runs before build

#### 2. SSR 500 errors

**Cause**: Server-side code trying to access browser APIs

**Fix**: Check `isPlatformBrowser()` guards in Angular components

#### 3. API calls fail (404 or CORS)

**Cause**: Rewrite rules not working

**Fix**:

- Verify `vercel.json` rewrites
- Check Tailscale URL is accessible: `curl https://pushups.tail433f94.ts.net/api/health`
- Ensure Tailscale service is running locally

#### 4. Build exceeds time limit

**Cause**: Nx cache not utilized

**Fix**:

```bash
# Add Vercel Remote Cache (optional)
npm install --save-dev @vercel/remote-nx
```

Then configure in `nx.json`:

```json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "@vercel/remote-nx",
      "options": {
        "cacheableOperations": ["build", "test", "lint"]
      }
    }
  }
}
```

## i18n (Internationalization)

The web app supports German (default) and English:

- **German**: `/` and `/de/*`
- **English**: `/en/*`

Vercel automatically serves both locales:

- `dist/web/browser/de/` → `/de/*`
- `dist/web/browser/en/` → `/en/*`

Language switching is handled client-side via cookie + redirect.

## Testing Deployment

### Pre-deployment Checklist

Before merging to `main`:

```bash
# 1. Build locally
npx nx build web --configuration=production

# 2. Test SSR server locally
cd dist/web/server
node server.mjs
# Visit http://localhost:8789

# 3. Check bundle sizes
npx nx build web --configuration=production --verbose
# Look for budget warnings in output

# 4. Run E2E tests (optional)
npx nx e2e web-e2e
```

### Post-deployment Verification

After successful deployment:

1. **Check homepage loads**: `https://your-vercel-url.vercel.app`
2. **Test language switch**: Click language toggle (DE ↔ EN)
3. **Verify API proxy**: Open DevTools → Network → Check `/api/stats` request
4. **Test on mobile**: Vercel provides mobile preview in dashboard

## Rollback Strategy

If a deployment fails:

1. **Instant rollback** via Vercel Dashboard:
   - Go to Deployments
   - Click on last working deployment
   - Click **"Promote to Production"**

2. **Git revert**:
   ```bash
   git revert HEAD
   git push origin main
   ```

## Security Considerations

- ✅ API is behind Tailscale (not publicly exposed)
- ✅ No secrets in environment variables (Firebase configured client-side)
- ✅ CORS handled by API server, not Vercel
- ⚠️ Ensure Tailscale ACLs restrict API access to authorized clients

## Cost Estimate

**Vercel Free Tier** (Hobby Plan):

- ✅ 100 GB bandwidth/month
- ✅ Unlimited preview deployments
- ✅ 100 GB-hours serverless function execution
- ✅ 1 concurrent build

**Expected usage**:

- Personal project with low traffic → Free tier sufficient
- If you exceed limits, Vercel will notify you

## Troubleshooting Commands

```bash
# Check Vercel CLI version
vercel --version

# Inspect deployment
vercel inspect <deployment-url>

# View environment variables
vercel env ls

# Pull production environment locally
vercel env pull .env.local

# Check build locally with exact Vercel setup
vercel build
```

## Next Steps

- [ ] Set up custom domain (optional): `pushup-stats.yourdomain.com`
- [ ] Configure Vercel Speed Insights
- [ ] Enable Web Analytics
- [ ] Set up deployment notifications in Slack/Discord

## Support

- **Vercel Docs**: https://vercel.com/docs
- **Nx Vercel Integration**: https://vercel.com/docs/monorepos/nx
- **Project Issues**: https://github.com/WolfSoko/pushup-stats-service/issues

---

**Last Updated**: 2026-02-21  
**Maintained by**: Einstein Openclaw (einstein-openclaw@gmail.com)
