# Quick Start - Get Your App Running in 5 Minutes

## Step 1: Create .env File

**Option A: Use the setup script (easiest)**
```bash
./setup.sh
```

**Option B: Manual creation**
1. Create a file named `.env` in the project root
2. Add these lines (replace with your actual values):
```bash
VITE_SUPABASE_URL=https://flcewhvladymqgpjbtvo.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Get your credentials:**
- Go to: https://supabase.com/dashboard → Your Project → Settings → API
- Copy "Project URL" → `VITE_SUPABASE_URL`
- Copy "anon public" key → `VITE_SUPABASE_ANON_KEY`

## Step 2: Set Edge Function Secret

```bash
# Get your service_role key from Supabase Dashboard → Settings → API
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## Step 3: Deploy Edge Functions

```bash
supabase functions deploy server
```

## Step 4: Verify Database

```bash
# Check if data exists
supabase db execute "SELECT COUNT(*) FROM teams;"
```

If count is 0, the database is empty. The seed migration should have populated it. If not, you may need to populate it manually or via FPL API.

## Step 5: Start Dev Server

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

## Troubleshooting

**"Missing Supabase environment variables"**
→ Make sure `.env` exists and restart dev server

**404 errors on API calls**
→ Edge Function not deployed - run `supabase functions deploy server`

**"No data available"**
→ Database is empty - check with `supabase db execute "SELECT COUNT(*) FROM teams;"`

**CORS errors**
→ Edge Function CORS is already configured, but verify it's deployed

## Full Documentation

- `SETUP_GUIDE.md` - Detailed setup instructions
- `SYSTEMS_CHECK.md` - Comprehensive troubleshooting guide
- `./diagnose.sh` - Run diagnostics on your setup
