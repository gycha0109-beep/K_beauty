# Local Setup

This project has two runnable parts:

- Next.js app in the repository root
- crawler CLI in `crawler/`

Use this when you need to match another PC to the same working environment.

## 1. Pull the latest code

```powershell
cd "D:\Ji_hwan\K_Beauti AI"
git pull
```

## 2. Match the runtime version

Check the machine that already works and use the same versions here:

```powershell
node -v
npm -v
```

If versions differ a lot, fix that first before debugging package issues.

## 3. Install root app dependencies

```powershell
cd "D:\Ji_hwan\K_Beauti AI"
npm install
```

## 4. Install crawler dependencies

```powershell
cd "D:\Ji_hwan\K_Beauti AI\crawler"
npm install
npx playwright install chromium
```

## 5. Copy environment variables

Do not commit real secrets to Git.

This codebase reads env files from both places:

- `D:\Ji_hwan\K_Beauti AI\.env.local`
- `D:\Ji_hwan\K_Beauti AI\crawler\.env`

The crawler can also read the root `.env.local`, so one correctly configured root file is usually enough.

Required variables by area:

### App

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...
```

### Crawler

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## 6. Verify the web app

```powershell
cd "D:\Ji_hwan\K_Beauti AI"
npm run dev
```

Expected local URL:

- `http://localhost:3001`

## 7. Verify the crawler safely

Run a dry-run first:

```powershell
cd "D:\Ji_hwan\K_Beauti AI\crawler"
npm run crawl -- --dry-run --max-pages=2
```

If that works, run the real crawl:

```powershell
npm run crawl
```

## 8. Review and promotion commands

Useful checks after crawling:

```powershell
cd "D:\Ji_hwan\K_Beauti AI\crawler"
npm run review:prep -- --limit=100
npm run list:candidates -- --status=needs_review --limit=20
npm run list:candidates -- --status=approved --limit=20
```

Approve and promote manually:

```powershell
npm run approve:candidate -- --id=<candidate-id>
npm run promote:approved -- --actor=<your-name>
```

## 9. Fast troubleshooting

If `git pull` succeeded but behavior still differs across PCs, check these first:

- Node and npm versions are the same
- root `.env.local` exists and has the expected keys
- `crawler/node_modules` is installed
- Playwright Chromium is installed
- Supabase keys point to the same project

## 10. Recommended operating rule

Keep machines aligned like this:

- sync code with Git
- sync secrets by copying `.env.local` manually
- reinstall dependencies instead of copying `node_modules`
- re-run `npx playwright install chromium` on each machine
