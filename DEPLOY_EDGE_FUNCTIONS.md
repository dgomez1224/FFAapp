# Deploy Edge Functions - Step by Step Guide

## Prerequisites

1. **Logged into Supabase CLI**
   ```bash
   supabase login
   ```
   This will open a browser window for authentication.

2. **Project Linked**
   Your project should already be linked (project-ref: `flcewhvladymqgpjbtvo`), but if not:
   ```bash
   supabase link --project-ref flcewhvladymqgpjbtvo
   ```

3. **Service Role Key Set as Secret**
   ```bash
   # Get your service_role key from: Supabase Dashboard → Settings → API
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

## Deployment Steps

### Step 1: Verify Edge Function Structure

The Edge Function is located at:
```
supabase/functions/server/index.ts
```

It should export a Hono app with all routes configured. Verify the file exists and has content.

### Step 2: Deploy the Function

```bash
supabase functions deploy server
```

**Expected Output:**
```
Deploying function server...
Function server deployed successfully
```

### Step 3: Verify Deployment

```bash
supabase functions list
```

You should see `server` in the list of deployed functions.

### Step 4: Test the Endpoint

After deployment, test that it's working:

```bash
# Replace YOUR_ANON_KEY with your actual anon key
curl -X GET "https://flcewhvladymqgpjbtvo.supabase.co/functions/v1/server/current-gameweek" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "apikey: YOUR_ANON_KEY"
```

**Expected Response:**
```json
{
  "current_gameweek": 1,
  "deadline_time": null,
  "hasSeasonState": false
}
```

## Troubleshooting

### Error: "Access token not provided"

**Solution:** Login to Supabase CLI
```bash
supabase login
```

### Error: "Project not linked"

**Solution:** Link your project
```bash
supabase link --project-ref flcewhvladymqgpjbtvo
```

### Error: "Function deployment failed"

**Possible causes:**
1. **Syntax errors in index.ts** - Check for TypeScript errors
2. **Missing dependencies** - Verify `deno.json` has all required imports
3. **Network issues** - Check your internet connection

**Debug:**
```bash
supabase functions deploy server --debug
```

### Error: "Database connection failed" (after deployment)

**Solution:** Set the service role key secret
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 404 Error when testing endpoint

**Check:**
1. Function name matches URL path (`/server`)
2. Route is registered in `index.ts`
3. CORS is configured (it should be - see line 1921)

## Available Endpoints After Deployment

Once deployed, these endpoints will be available at:
`https://flcewhvladymqgpjbtvo.supabase.co/functions/v1/server/{endpoint}`

- `/current-gameweek` - Get current gameweek number
- `/league-standings` - Get league standings
- `/cup-group-stage` - Get cup group stage data
- `/goblet-standings` - Get goblet standings
- `/manager-insights` - Get manager insights
- `/player-insights` - Get player insights
- `/h2h-standings` - Get H2H standings
- `/live-scores/:gameweek` - Get live scores for a gameweek
- `/manager-ratings` - Get manager ratings
- `/standings-by-gameweek` - Get standings by gameweek
- `/bracket` - Get bracket data
- `/league-history` - Get league history
- `/legacy-stats/*` - Legacy statistics endpoints

## Next Steps After Deployment

1. ✅ Verify deployment with test request
2. ✅ Check database has data (use Supabase Dashboard SQL Editor)
3. ✅ Create `.env` file if not done yet
4. ✅ Start dev server: `npm run dev`
5. ✅ Test in browser

## Quick Command Reference

```bash
# Login
supabase login

# Link project
supabase link --project-ref flcewhvladymqgpjbtvo

# Set secret
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key

# Deploy
supabase functions deploy server

# List functions
supabase functions list

# View logs
supabase functions logs server

# Test endpoint
curl -X GET "https://flcewhvladymqgpjbtvo.supabase.co/functions/v1/server/current-gameweek" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "apikey: YOUR_ANON_KEY"
```
