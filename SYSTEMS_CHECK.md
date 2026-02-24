# Systems Check Report - FFA Cup Web Application

**Date:** 2025-01-29  
**Status:** 🔴 **CRITICAL ISSUES IDENTIFIED**

## Executive Summary

The application is not fetching data due to multiple critical configuration and deployment issues. The primary problems are:

1. **Missing Environment Variables** - No Supabase credentials configured
2. **Edge Functions Not Deployed** - Backend API endpoints are not available
3. **Empty Database** - No teams, season state, or gameweek scores
4. **Potential CORS Issues** - Edge Functions may not have proper CORS headers

---

## Issue #1: Missing Environment Variables ⚠️ CRITICAL

### Problem
The application requires two environment variables that are not configured:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous/public key

### Evidence
```typescript
// src/lib/supabaseClient.ts
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Missing Supabase environment variables...");
}
```

### Impact
- All API calls to Edge Functions will fail
- No authentication headers will be sent
- Frontend cannot connect to backend

### Fix
1. Create a `.env` file in the project root:
```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

2. Get your credentials from:
   - Supabase Dashboard → Settings → API
   - Copy "Project URL" and "anon public" key

3. Restart the dev server after adding the file

---

## Issue #2: Edge Functions Not Deployed ⚠️ CRITICAL

### Problem
The Edge Functions code exists locally but may not be deployed to Supabase.

### Evidence
- Edge Functions are defined in `supabase/functions/server/index.ts`
- Routes are configured: `/league-standings`, `/current-gameweek`, etc.
- No deployment verification found

### Impact
- All API endpoints return 404 or connection errors
- Frontend cannot fetch any data

### Fix
1. **Deploy Edge Functions:**
```bash
# Make sure you're logged in
supabase login

# Link to your project (if not already linked)
supabase link --project-ref your-project-ref

# Deploy the server function
supabase functions deploy server
```

2. **Verify Deployment:**
```bash
# List deployed functions
supabase functions list
```

3. **Test an endpoint:**
```bash
curl -X GET "https://your-project-id.supabase.co/functions/v1/server/current-gameweek" \
  -H "Authorization: Bearer your-anon-key"
```

---

## Issue #3: Empty Database ⚠️ CRITICAL

### Problem
The database has no data:
- No `teams` records
- No `season_state` record for 2025/26
- No `gameweek_scores` data
- No `manager_aliases` mappings

### Evidence
The Edge Functions query these tables:
```typescript
// resolveLeagueContextFromDb queries:
- season_state (for current_gameweek, league_id)
- teams (for all league members)
- gameweek_scores (for standings)
```

If these are empty, endpoints will return empty arrays or null values.

### Impact
- League standings will be empty
- Current gameweek will default to 1
- All components show "No data available"

### Fix

**Option A: Use Seed Data (Quick Start)**
The migration `20260129_seed_placeholders.sql` should have populated placeholder data. Verify:

```sql
-- Check if seed data exists
SELECT COUNT(*) FROM teams;
SELECT COUNT(*) FROM season_state;
SELECT COUNT(*) FROM gameweek_scores;
```

If counts are 0, the seed migration may have failed. Re-run:
```bash
supabase db push --include-all
```

**Option B: Populate from FPL API (Production)**
You need to:
1. Fetch teams from FPL API using `STATIC_ENTRY_ID` (164475)
2. Insert into `teams` table
3. Create `season_state` record
4. Populate `gameweek_scores` for completed gameweeks

**Create a data sync script:**
```typescript
// This should be run once to initialize the database
// Could be an admin Edge Function endpoint or a one-time script
```

---

## Issue #4: CORS Configuration ⚠️ MEDIUM

### Problem
Edge Functions may not have CORS headers configured for frontend requests.

### Evidence
```typescript
// supabase/functions/server/index.ts
import { cors } from "npm:hono/cors";

// But CORS middleware may not be applied to all routes
```

### Impact
- Browser blocks API requests with CORS errors
- Console shows: "Access to fetch at ... has been blocked by CORS policy"

### Fix
Ensure CORS is applied to the main app:

```typescript
// In supabase/functions/server/index.ts
const app = new Hono();

// Add CORS middleware
app.use('/*', cors({
  origin: '*', // Or specify your frontend URL
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'apikey'],
}));
```

---

## Issue #5: Route Path Mismatch ⚠️ LOW

### Problem
Frontend uses `/server` as the base path, but Edge Function might be deployed differently.

### Evidence
```typescript
// src/lib/constants.ts
export const EDGE_FUNCTIONS_BASE =
  import.meta.env.VITE_EDGE_FUNCTIONS_BASE || "/server";

// Frontend constructs URLs like:
// ${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/league-standings
// Results in: .../functions/v1/server/league-standings
```

### Impact
- If Edge Function is deployed as `/server`, it works
- If deployed as root or different name, 404 errors

### Fix
1. **Verify Edge Function name:**
   - Supabase Functions are deployed by folder name
   - Folder: `supabase/functions/server/` → Function name: `server`
   - URL path: `/functions/v1/server`

2. **If mismatch, either:**
   - Rename the function folder to match expected path
   - Or update `EDGE_FUNCTIONS_BASE` constant

---

## Issue #6: Database Connection in Edge Functions ⚠️ MEDIUM

### Problem
Edge Functions use environment variables that may not be set:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Evidence
```typescript
const getSupabaseAdmin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
```

### Impact
- Edge Functions cannot connect to database
- All queries fail silently or return errors

### Fix
1. **Set secrets in Supabase:**
```bash
supabase secrets set SUPABASE_URL=https://your-project-id.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

2. **Verify secrets:**
```bash
supabase secrets list
```

**Note:** `SUPABASE_URL` is usually auto-injected by Supabase, but `SUPABASE_SERVICE_ROLE_KEY` must be set manually.

---

## Diagnostic Checklist

Run through this checklist to identify which issues affect your setup:

- [ ] **Environment Variables**
  - [ ] `.env` file exists in project root
  - [ ] `VITE_SUPABASE_URL` is set and valid
  - [ ] `VITE_SUPABASE_ANON_KEY` is set and valid
  - [ ] Dev server restarted after adding `.env`

- [ ] **Edge Functions**
  - [ ] Logged into Supabase CLI (`supabase login`)
  - [ ] Project linked (`supabase link`)
  - [ ] Functions deployed (`supabase functions deploy server`)
  - [ ] Can access function URL in browser/Postman

- [ ] **Database**
  - [ ] `teams` table has 10 records
  - [ ] `season_state` has record for "2025/26"
  - [ ] `gameweek_scores` has data (if season started)
  - [ ] `manager_aliases` has mappings

- [ ] **CORS**
  - [ ] No CORS errors in browser console
  - [ ] CORS middleware applied in Edge Function

- [ ] **Secrets**
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` set in Supabase secrets
  - [ ] Edge Functions can query database

---

## Quick Fix Script

Run this to check your setup:

```bash
# 1. Check environment variables
echo "Checking .env file..."
if [ -f .env ]; then
  echo "✓ .env exists"
  grep -q "VITE_SUPABASE_URL" .env && echo "✓ VITE_SUPABASE_URL set" || echo "✗ VITE_SUPABASE_URL missing"
  grep -q "VITE_SUPABASE_ANON_KEY" .env && echo "✓ VITE_SUPABASE_ANON_KEY set" || echo "✗ VITE_SUPABASE_ANON_KEY missing"
else
  echo "✗ .env file not found"
fi

# 2. Check Supabase connection
echo ""
echo "Checking Supabase connection..."
supabase status 2>/dev/null && echo "✓ Supabase CLI connected" || echo "✗ Supabase CLI not connected"

# 3. Check database
echo ""
echo "Checking database..."
# This would require a database query - add if needed
```

---

## Testing After Fixes

1. **Test Edge Function directly:**
```bash
curl -X GET "https://your-project-id.supabase.co/functions/v1/server/current-gameweek" \
  -H "Authorization: Bearer your-anon-key" \
  -H "apikey: your-anon-key"
```

Expected response:
```json
{
  "current_gameweek": 1,
  "deadline_time": null,
  "hasSeasonState": false
}
```

2. **Test from browser console:**
```javascript
fetch('https://your-project-id.supabase.co/functions/v1/server/current-gameweek', {
  headers: {
    'Authorization': 'Bearer your-anon-key',
    'apikey': 'your-anon-key'
  }
})
.then(r => r.json())
.then(console.log)
```

3. **Check browser Network tab:**
   - Open DevTools → Network
   - Look for requests to `/functions/v1/server/*`
   - Check status codes (should be 200, not 404 or CORS errors)

---

## Most Likely Root Cause

Based on the codebase analysis, the **most likely issue** is:

1. **Missing `.env` file** (Issue #1) - Frontend can't connect
2. **Edge Functions not deployed** (Issue #2) - No backend available
3. **Empty database** (Issue #3) - No data to return

**Recommended Fix Order:**
1. Create `.env` file with Supabase credentials
2. Deploy Edge Functions
3. Verify database has data (run seed migration if needed)
4. Test endpoints
5. Fix CORS if needed

---

## Next Steps

1. **Immediate:** Create `.env` file and deploy Edge Functions
2. **Short-term:** Populate database with initial data
3. **Long-term:** Set up automated data sync from FPL API

---

## Additional Resources

- [Supabase Environment Variables](https://supabase.com/docs/guides/getting-started/local-development#environment-variables)
- [Deploying Edge Functions](https://supabase.com/docs/guides/functions/deploy)
- [Supabase Secrets](https://supabase.com/docs/guides/functions/secrets)
