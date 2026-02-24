# Quick Deploy - Edge Functions

## Fastest Way to Deploy

Run the automated script:
```bash
./deploy.sh
```

This script will:
1. ✅ Check if you're logged in
2. ✅ Verify project is linked
3. ✅ Check if secrets are set
4. ✅ Deploy the Edge Function

## Manual Deployment (3 Steps)

### 1. Login to Supabase CLI
```bash
supabase login
```
Opens browser for authentication.

### 2. Set Service Role Key (if not already set)
```bash
# Get from: Supabase Dashboard → Settings → API → service_role key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Deploy
```bash
supabase functions deploy server
```

## Verify Deployment

```bash
# List deployed functions
supabase functions list

# Test endpoint
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

## Troubleshooting

**"Access token not provided"**
→ Run: `supabase login`

**"Project not linked"**
→ Run: `supabase link --project-ref flcewhvladymqgpjbtvo`

**"Database connection failed"**
→ Set service role key: `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`

**Deployment fails with errors**
→ Check `supabase/functions/server/index.ts` for syntax errors
→ Run: `supabase functions deploy server --debug`

## Full Documentation

See `DEPLOY_EDGE_FUNCTIONS.md` for detailed instructions.
