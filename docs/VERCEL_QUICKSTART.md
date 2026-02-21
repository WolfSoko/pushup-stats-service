# Vercel Quick Start (5 Minutes)

## TL;DR

Deploy the PUS web app to Vercel in 5 steps:

### 1. Import to Vercel

Go to: https://vercel.com/new

- Select **WolfSoko/pushup-stats-service**
- Click "Import"

### 2. Configure Project

| Setting          | Value                                         |
| ---------------- | --------------------------------------------- |
| Framework Preset | **Other**                                     |
| Root Directory   | `./`                                          |
| Build Command    | `npx nx build web --configuration=production` |
| Output Directory | `dist/web/browser`                            |
| Install Command  | `npm install`                                 |

### 3. Environment Variables

**Skip this step** - no env vars needed! 🎉

### 4. Deploy

Click **"Deploy"** and wait ~2-3 minutes.

### 5. Test

Visit your deployment URL:

- Homepage loads? ✅
- Language toggle works (DE ↔ EN)? ✅
- API calls work (check DevTools Network tab)? ✅

## What Gets Deployed?

- ✅ **web** (Angular SSR) → Vercel
- ❌ **api** (NestJS) → Stays on Tailscale
- ❌ **reverse-proxy** → Stays local

API requests (`/api/*`) are automatically proxied to:

```
https://pushups.tail433f94.ts.net
```

## Troubleshooting

### Build fails?

Check logs in Vercel dashboard:

- Look for "Cannot find module" → Install command issue
- "Out of memory" → Bundle too large (upgrade plan or optimize)

### API calls fail?

1. Check Tailscale URL is accessible:

   ```bash
   curl https://pushups.tail433f94.ts.net/api/health
   ```

2. Verify `vercel.json` rewrites are correct

3. Check browser DevTools → Network → Failed request details

### Still stuck?

See full guide: [docs/VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)

## Next Steps After First Deploy

- [ ] Add custom domain (optional)
- [ ] Enable Vercel Speed Insights
- [ ] Set up preview deployments for PRs
- [ ] Configure deployment notifications

---

**Need help?** Open an issue: https://github.com/WolfSoko/pushup-stats-service/issues
