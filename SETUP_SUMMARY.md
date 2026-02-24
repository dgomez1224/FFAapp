# Setup Summary - What We've Done

## ✅ Files Created

1. **`.env.example`** - Template for environment variables (you need to create `.env` from this)
2. **`setup.sh`** - Interactive script to create `.env` file
3. **`SETUP_GUIDE.md`** - Comprehensive setup instructions
4. **`QUICK_START.md`** - Quick 5-minute setup guide
5. **`SYSTEMS_CHECK.md`** - Detailed troubleshooting and diagnostics
6. **`diagnose.sh`** - Automated diagnostic script

## ✅ What's Already Configured

1. **CORS** - Edge Functions have CORS middleware configured (line 1921-1930 in `index.ts`)
2. **Edge Function Routes** - All routes are properly registered
3. **Database Migrations** - Schema migrations exist and are ready
4. **Frontend Code** - All components are set up to fetch from Edge Functions

## 🔧 What You Need to Do

### 1. Create `.env` File (REQUIRED)

**Easiest way:**
```bash
./setup.sh
```

**Or manually:**
Create `.env` file with:
```bash
VITE_SUPABASE_URL=https://flcewhvladymqgpjbtvo.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Get credentials from: Supabase Dashboard → Settings → API

### 2. Set Edge Function Secret (REQUIRED)

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get service role key from: Supabase Dashboard → Settings → API → service_role key

### 3. Deploy Edge Functions (REQUIRED)

```bash
supabase functions deploy server
```

### 4. Verify Database Has Data

```bash
supabase db execute "SELECT COUNT(*) FROM teams;"
```

If count is 0, you may need to:
- Re-run migrations: `supabase db push --include-all`
- Or populate data manually from FPL API

### 5. Start Dev Server

```bash
npm run dev
```

## 🧪 Testing

### Test Edge Function
```bash
curl -X GET "https://flcewhvladymqgpjbtvo.supabase.co/functions/v1/server/current-gameweek" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "apikey: YOUR_ANON_KEY"
```

### Test in Browser Console
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

## 📋 Checklist

- [ ] `.env` file created with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Edge Function secret set (`SUPABASE_SERVICE_ROLE_KEY`)
- [ ] Edge Functions deployed (`supabase functions deploy server`)
- [ ] Database has data (check teams table)
- [ ] Dev server running (`npm run dev`)
- [ ] Browser can access app
- [ ] API endpoints return data

## 🆘 Need Help?

1. **Run diagnostics:** `./diagnose.sh`
2. **Check detailed guide:** `SETUP_GUIDE.md`
3. **Troubleshooting:** `SYSTEMS_CHECK.md`
4. **Quick reference:** `QUICK_START.md`

## 🎯 Expected Behavior After Setup

Once everything is configured:

1. **Frontend loads** without "Missing Supabase environment variables" warning
2. **API calls succeed** - no 404 or CORS errors in browser console
3. **Data displays** - League standings, manager ratings, etc. show data
4. **No console errors** - Browser DevTools shows no red errors

## 🔍 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Missing Supabase environment variables" | Create `.env` file and restart dev server |
| 404 errors on API calls | Deploy Edge Functions: `supabase functions deploy server` |
| CORS errors | CORS is configured, verify Edge Function is deployed |
| "No data available" | Database is empty - populate it or check migrations |
| Database connection errors | Set `SUPABASE_SERVICE_ROLE_KEY` secret |

## 📚 Documentation Files

- **QUICK_START.md** - Fastest way to get running
- **SETUP_GUIDE.md** - Step-by-step detailed instructions
- **SYSTEMS_CHECK.md** - Comprehensive troubleshooting
- **diagnose.sh** - Automated diagnostic tool
- **setup.sh** - Interactive .env file creator

---

**Next Step:** Run `./setup.sh` to create your `.env` file!
