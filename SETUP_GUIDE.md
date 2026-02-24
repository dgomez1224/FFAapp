# FFA Cup Web Application - Setup Guide

This guide will help you get the application running step-by-step.

## Prerequisites

- Node.js and npm installed
- Supabase account and project
- Supabase CLI installed (`npm install -g supabase`)

---

## Step 1: Create Environment Variables File

### Option A: Manual Creation

1. Create a file named `.env` in the project root
2. Add the following content:

```bash
VITE_SUPABASE_URL=https://flcewhvladymqgpjbtvo.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

3. Get your credentials from:
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your project
   - Navigate to **Settings → API**
   - Copy **Project URL** → paste as `VITE_SUPABASE_URL`
   - Copy **anon public** key → paste as `VITE_SUPABASE_ANON_KEY`

### Option B: Use Setup Script

Run the setup script:
```bash
./setup.sh
```

This will prompt you for your Supabase credentials and create the `.env` file automatically.

---

## Step 2: Login to Supabase CLI

```bash
supabase login
```

This will open a browser window for authentication.

---

## Step 3: Link Your Project

Your project is already linked (project-ref: `flcewhvladymqgpjbtvo`), but if you need to re-link:

```bash
supabase link --project-ref flcewhvladymqgpjbtvo
```

---

## Step 4: Set Edge Function Secrets

Edge Functions need the service role key to access the database:

```bash
# Get your service role key from Supabase Dashboard → Settings → API
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**⚠️ Important:** Use the **service_role** key (not the anon key). This key has admin privileges and should never be exposed in the frontend.

---

## Step 5: Deploy Edge Functions

Deploy the server Edge Function:

```bash
supabase functions deploy server
```

You should see output like:
```
Deploying function server...
Function server deployed successfully
```

---

## Step 6: Verify Database Has Data

**Note:** The `supabase db execute` command may not be available in all CLI versions. Use one of these methods:

### Option A: Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor**
4. Run the queries from `check-database.sql`:

```sql
-- Check teams count
SELECT COUNT(*) as team_count FROM teams;

-- Check season_state for 2025/26
SELECT * FROM season_state WHERE season = '2025/26';

-- Check gameweek_scores count
SELECT COUNT(*) as gameweek_scores_count FROM gameweek_scores;
```

### Option B: Use check-database.sh script

```bash
./check-database.sh
```

This will test if your Edge Function is accessible and provide instructions.

### If Database is Empty

If the counts are 0, you need to populate the database. The seed migration should have done this, but if it didn't:

1. **Re-run seed migration:**
   ```bash
   supabase db push --include-all
   ```

2. **Or manually populate via SQL:**
   - The seed migration (`20260129_seed_placeholders.sql`) should have created placeholder data
   - Check if it ran successfully

3. **Or fetch from FPL API:**
   - You'll need to create a script or use an admin endpoint to fetch teams from FPL API
   - This requires the FPL API to be accessible

---

## Step 7: Test Edge Function

Test that your Edge Function is working:

```bash
# Replace YOUR_ANON_KEY with your actual anon key
curl -X GET "https://flcewhvladymqgpjbtvo.supabase.co/functions/v1/server/current-gameweek" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "apikey: YOUR_ANON_KEY"
```

Expected response:
```json
{
  "current_gameweek": 1,
  "deadline_time": null,
  "hasSeasonState": false
}
```

---

## Step 8: Start Development Server

```bash
npm run dev
```

The app should start on `http://localhost:5173` (or another port if 5173 is busy).

---

## Step 9: Verify in Browser

1. Open `http://localhost:5173` in your browser
2. Open Developer Tools (F12) → Console tab
3. Check for any errors

### Common Issues:

**Error: "Missing Supabase environment variables"**
- Solution: Make sure `.env` file exists and has correct values
- Restart the dev server after creating/updating `.env`

**Error: "Failed to fetch" or CORS errors**
- Solution: Verify Edge Function is deployed
- Check that CORS is configured (it should be - see `index.ts` line 1921)

**Error: "No data available"**
- Solution: Database is empty - populate it (see Step 6)

**404 errors on API calls**
- Solution: Edge Function not deployed - run `supabase functions deploy server`

---

## Step 10: Test Individual Components

### Test Current Gameweek Endpoint

In browser console:
```javascript
fetch('https://flcewhvladymqgpjbtvo.supabase.co/functions/v1/server/current-gameweek', {
  headers: {
    'Authorization': 'Bearer YOUR_ANON_KEY',
    'apikey': 'YOUR_ANON_KEY'
  }
})
.then(r => r.json())
.then(console.log)
```

### Test League Standings Endpoint

```javascript
fetch('https://flcewhvladymqgpjbtvo.supabase.co/functions/v1/server/league-standings', {
  headers: {
    'Authorization': 'Bearer YOUR_ANON_KEY',
    'apikey': 'YOUR_ANON_KEY'
  }
})
.then(r => r.json())
.then(console.log)
```

---

## Troubleshooting

### Edge Function Returns 404

1. Verify function is deployed: `supabase functions list`
2. Check function name matches URL path (`/server`)
3. Verify project is linked correctly

### Database Queries Fail

1. Check service role key is set: `supabase secrets list`
2. Verify RLS policies allow public read access
3. Check database connection in Supabase Dashboard

### Frontend Can't Connect

1. Verify `.env` file exists and has correct values
2. Restart dev server after changing `.env`
3. Check browser console for specific error messages
4. Verify Supabase URL format: `https://PROJECT_ID.supabase.co`

---

## Quick Verification Checklist

- [ ] `.env` file created with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Supabase CLI logged in (`supabase login`)
- [ ] Project linked (`supabase link`)
- [ ] Service role key set as secret (`supabase secrets set`)
- [ ] Edge Function deployed (`supabase functions deploy server`)
- [ ] Database has data (teams, season_state)
- [ ] Dev server running (`npm run dev`)
- [ ] Browser can access app without console errors
- [ ] API endpoints return data (test with curl or browser console)

---

## Next Steps

Once everything is working:

1. **Populate Real Data:** Replace placeholder data with actual FPL league data
2. **Set Up Weekly Sync:** Configure automated data updates from FPL API
3. **Deploy to Production:** Set up hosting for the frontend (Vercel, Netlify, etc.)

---

## Need Help?

- Check `SYSTEMS_CHECK.md` for detailed troubleshooting
- Run `./diagnose.sh` to check your setup
- Review Supabase logs: `supabase functions logs server`
